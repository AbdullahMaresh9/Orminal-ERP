import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function audit() {
  console.log('====================================================')
  console.log('        DATABASE & ARCHITECTURE DEEP AUDIT          ')
  console.log('====================================================\n')

  const report = {
    accounts: { total: 0, groups: 0, posting: 0, inactive: 0, nullPaths: 0 },
    roleMappings: { mappedCount: 0, missingRoles: [] },
    rolesPermissions: { rolesCount: 0, permissionsCount: 0, rolePermissionsCount: 0 },
    journalEntries: { total: 0, totalDebit: 0, totalCredit: 0, unbalancedCount: 0 },
    partners: { total: 0, customers: 0, suppliers: 0 },
    products: { total: 0 },
    orphans: {},
  }

  // 1. Audit Accounts
  const accounts = await db.account.findMany()
  report.accounts.total = accounts.length
  report.accounts.groups = accounts.filter(a => !a.isPosting).length
  report.accounts.posting = accounts.filter(a => a.isPosting).length
  report.accounts.inactive = accounts.filter(a => !a.active).length
  report.accounts.nullPaths = accounts.filter(a => !a.path).length

  // 2. Audit AccountRoleMapping
  const mappings = await db.accountRoleMapping.findMany({ include: { account: true } })
  report.roleMappings.mappedCount = mappings.length

  const expectedRoles = [
    'CASH', 'BANK', 'CUSTOMER_RECEIVABLE', 'INVENTORY', 'RAW_MATERIALS', 'FINISHED_GOODS',
    'WIP', 'TAX_RECEIVABLE', 'ASSET', 'ACCUMULATED_DEPRECIATION', 'SUSPENSE', 'SUPPLIER_PAYABLE',
    'TAX_PAYABLE', 'SALARIES_PAYABLE', 'PAYROLL_DEDUCTIONS_PAYABLE', 'GRNI', 'RETAINED_EARNINGS',
    'CURRENT_YEAR_EARNINGS', 'OPENING_BALANCE', 'SALES', 'SALES_RETURN', 'SALES_DISCOUNT',
    'COGS', 'PURCHASE', 'PURCHASE_RETURN', 'PRODUCTION_COST', 'PAYROLL', 'DEPRECIATION',
    'OTHER_REVENUE', 'FX_GAIN', 'INVENTORY_GAIN', 'FX_LOSS', 'ROUNDING', 'INVENTORY_LOSS'
  ]

  const mappedRoleNames = new Set(mappings.map(m => m.role))
  report.roleMappings.missingRoles = expectedRoles.filter(r => !mappedRoleNames.has(r))

  // 3. Audit Roles & Permissions
  const roles = await db.role.findMany()
  const permissions = await db.permission.findMany()
  const rolePermissions = await db.rolePermission.findMany()
  report.rolesPermissions.rolesCount = roles.length
  report.rolesPermissions.permissionsCount = permissions.length
  report.rolesPermissions.rolePermissionsCount = rolePermissions.length

  // 4. Audit Journal Entries
  const entries = await db.journalEntry.findMany({ select: { id: true, code: true, totalDebit: true, totalCredit: true } })
  report.journalEntries.total = entries.length
  let unbalanced = 0
  for (const e of entries) {
    report.journalEntries.totalDebit += e.totalDebit
    report.journalEntries.totalCredit += e.totalCredit
    if (Math.abs(e.totalDebit - e.totalCredit) > 0.01) {
      unbalanced++
    }
  }
  report.journalEntries.unbalancedCount = unbalanced

  // 5. Audit Partners & Products
  report.partners.total = await db.partner.count()
  report.partners.customers = await db.partner.count({ where: { isCustomer: true } })
  report.partners.suppliers = await db.partner.count({ where: { isSupplier: true } })
  report.products.total = await db.product.count()

  // 6. Check for Orphaned Records
  const orphanJournalLines = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::int as count FROM "JournalLine" jl 
    LEFT JOIN "Account" a ON jl."accountId" = a."id" 
    WHERE a."id" IS NULL
  `)
  report.orphans.journalLinesWithoutAccount = orphanJournalLines[0]?.count || 0

  const orphanAccountsParent = await db.$queryRawUnsafe(`
    SELECT COUNT(*)::int as count FROM "Account" a 
    WHERE a."parentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Account" p WHERE p."id" = a."parentId")
  `)
  report.orphans.accountsWithMissingParent = orphanAccountsParent[0]?.count || 0

  console.log(JSON.stringify(report, null, 2))
  await db.$disconnect()
}

audit().catch(console.error)
