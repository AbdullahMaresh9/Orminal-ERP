#!/usr/bin/env node
/**
 * Chart of Accounts re-engineering — DATA migration.
 *
 *   node scripts/migrate-chart-of-accounts.mjs --dry-run   # report only, no writes
 *   node scripts/migrate-chart-of-accounts.mjs             # apply
 *
 * Run the schema migration first (prisma migrate deploy, or the SQL in
 * prisma/migrations/20260817000000_chart_of_accounts_reengineering/migration.sql).
 *
 * SAFETY CONTRACT — this script never destroys accounting history:
 *   1. No account is ever deleted. Obsolete accounts are deactivated.
 *   2. No existing account id or code changes, so every JournalLine reference,
 *      Partner.receivableAccountId, Product.*AccountId, BankAccount and Safe
 *      link stays valid.
 *   3. An account that already carries journal lines is NEVER converted into a
 *      group account (that would create postings on a non-postable account).
 *      Instead, NEW group accounts are created above it and it is re-parented.
 *   4. Class reclassifications are restricted to ones that preserve the legacy
 *      ledger `type`, so existing reports and postings are unaffected. The two
 *      deliberate presentation changes (contra accounts) are reported explicitly.
 *   5. Everything runs in one transaction; any failure rolls the whole thing back.
 */

import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'

const db = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const log = (...a) => console.log(...a)
const warn = (...a) => console.warn('  ⚠ ', ...a)

// ---------------------------------------------------------------------------
// Target structure. `kind: 'group'` accounts are created if missing.
// Codes are stable identifiers used for idempotency.
// ---------------------------------------------------------------------------
const GROUPS = [
  // class roots
  { code: '1', nameAr: 'الأصول', nameEn: 'Assets', accountClass: 'asset', parent: null },
  { code: '2', nameAr: 'الالتزامات', nameEn: 'Liabilities', accountClass: 'liability', parent: null },
  { code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', accountClass: 'equity', parent: null },
  { code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', accountClass: 'revenue', parent: null },
  { code: '5', nameAr: 'تكلفة المبيعات', nameEn: 'Cost of Sales', accountClass: 'cogs', parent: null },
  { code: '6', nameAr: 'المصروفات التشغيلية', nameEn: 'Operating Expenses', accountClass: 'operating_expense', parent: null },
  { code: '7', nameAr: 'إيرادات أخرى', nameEn: 'Other Income', accountClass: 'other_income', parent: null },
  { code: '8', nameAr: 'مصروفات أخرى', nameEn: 'Other Expenses', accountClass: 'other_expense', parent: null },

  // assets
  { code: '11', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', accountClass: 'asset', parent: '1', subtype: 'current_asset' },
  { code: '111', nameAr: 'النقدية وما يعادلها', nameEn: 'Cash & Cash Equivalents', accountClass: 'asset', parent: '11', subtype: 'cash_and_equivalents' },
  { code: '112', nameAr: 'المدينون والذمم', nameEn: 'Receivables', accountClass: 'asset', parent: '11', subtype: 'receivable' },
  { code: '113', nameAr: 'المخزون', nameEn: 'Inventory', accountClass: 'asset', parent: '11', subtype: 'inventory' },
  { code: '114', nameAr: 'مصروفات مدفوعة مقدماً', nameEn: 'Prepaid Expenses', accountClass: 'asset', parent: '11', subtype: 'prepaid' },
  { code: '115', nameAr: 'أصول ضريبية', nameEn: 'Tax Assets', accountClass: 'asset', parent: '11', subtype: 'current_asset' },
  { code: '119', nameAr: 'حسابات وسيطة ومعلقة', nameEn: 'Suspense & Clearing', accountClass: 'asset', parent: '11', subtype: 'other_asset' },
  { code: '15', nameAr: 'الأصول غير المتداولة', nameEn: 'Non-Current Assets', accountClass: 'asset', parent: '1', subtype: 'fixed_asset' },
  { code: '151', nameAr: 'الأصول الثابتة', nameEn: 'Property, Plant & Equipment', accountClass: 'asset', parent: '15', subtype: 'fixed_asset' },
  { code: '159', nameAr: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation', accountClass: 'asset', parent: '15', subtype: 'contra_asset' },

  // liabilities
  { code: '21', nameAr: 'الالتزامات المتداولة', nameEn: 'Current Liabilities', accountClass: 'liability', parent: '2', subtype: 'current_liability' },
  { code: '211', nameAr: 'الدائنون والذمم', nameEn: 'Payables', accountClass: 'liability', parent: '21', subtype: 'payable' },
  { code: '212', nameAr: 'التزامات ضريبية', nameEn: 'Tax Liabilities', accountClass: 'liability', parent: '21', subtype: 'tax_liability' },
  { code: '213', nameAr: 'التزامات الرواتب', nameEn: 'Payroll Liabilities', accountClass: 'liability', parent: '21', subtype: 'accrued_liability' },
  { code: '214', nameAr: 'مستحقات أخرى', nameEn: 'Other Accruals', accountClass: 'liability', parent: '21', subtype: 'accrued_liability' },
  { code: '25', nameAr: 'الالتزامات طويلة الأجل', nameEn: 'Long-term Liabilities', accountClass: 'liability', parent: '2', subtype: 'long_term_liability' },

  // equity
  { code: '31', nameAr: 'رأس المال', nameEn: 'Capital', accountClass: 'equity', parent: '3', subtype: 'capital' },
  { code: '32', nameAr: 'الأرباح والاحتياطيات', nameEn: 'Earnings & Reserves', accountClass: 'equity', parent: '3', subtype: 'retained_earnings' },

  // revenue
  { code: '41', nameAr: 'إيرادات التشغيل', nameEn: 'Operating Revenue', accountClass: 'revenue', parent: '4', subtype: 'operating_revenue' },
  { code: '49', nameAr: 'حسابات مقابلة للإيراد', nameEn: 'Contra Revenue', accountClass: 'revenue', parent: '4', subtype: 'contra_revenue' },

  // cost of sales
  { code: '51', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', accountClass: 'cogs', parent: '5', subtype: 'cogs' },
  { code: '52', nameAr: 'المشتريات', nameEn: 'Purchases', accountClass: 'cogs', parent: '5', subtype: 'purchases' },
  { code: '53', nameAr: 'تكاليف الإنتاج', nameEn: 'Production Costs', accountClass: 'cogs', parent: '5', subtype: 'manufacturing_overhead' },

  // operating expenses
  { code: '61', nameAr: 'مصروفات الرواتب', nameEn: 'Payroll Expenses', accountClass: 'operating_expense', parent: '6', subtype: 'payroll_expense' },
  { code: '62', nameAr: 'مصروفات إدارية وعمومية', nameEn: 'General & Administrative', accountClass: 'operating_expense', parent: '6', subtype: 'administrative_expense' },
  { code: '63', nameAr: 'الإهلاك والاستنفاد', nameEn: 'Depreciation & Amortization', accountClass: 'operating_expense', parent: '6', subtype: 'depreciation_expense' },

  // other income / expense
  { code: '71', nameAr: 'إيرادات متنوعة', nameEn: 'Miscellaneous Income', accountClass: 'other_income', parent: '7', subtype: 'other_revenue' },
  { code: '81', nameAr: 'مصروفات متنوعة', nameEn: 'Miscellaneous Expenses', accountClass: 'other_expense', parent: '8', subtype: 'other_expense' },
]

/**
 * Where each existing posting account belongs, plus the corrections.
 * `normalBalance` is only set where it must differ from the class default
 * (contra accounts) — that is a presentation fix, reported explicitly.
 */
const REPARENT = [
  // assets
  { code: '1000', parent: '111', subtype: 'cash_and_equivalents', allowReconciliation: true },
  { code: '1010', parent: '111', subtype: 'cash_and_equivalents', allowReconciliation: true },
  { code: '1020', parent: '111', subtype: 'cash_and_equivalents', allowReconciliation: true },
  { code: '1100', parent: '112', subtype: 'receivable', allowReconciliation: true },
  { code: '1200', parent: '113', subtype: 'inventory' },
  { code: '1210', parent: '113', subtype: 'inventory' },
  { code: '1220', parent: '113', subtype: 'inventory' },
  { code: '1230', parent: '113', subtype: 'inventory' },
  { code: '1300', parent: '114', subtype: 'prepaid' },
  { code: '1400', parent: '115', subtype: 'current_asset', taxBehavior: 'input' },
  { code: '1500', parent: '151', subtype: 'fixed_asset' },
  { code: '1510', parent: '151', subtype: 'fixed_asset' },
  { code: '1520', parent: '151', subtype: 'fixed_asset' },
  // CORRECTION: accumulated depreciation is a CONTRA-ASSET (credit balance)
  { code: '1590', parent: '159', subtype: 'contra_asset', normalBalance: 'credit' },

  // liabilities
  { code: '2000', parent: '211', subtype: 'payable', allowReconciliation: true },
  { code: '2100', parent: '212', subtype: 'tax_liability', taxBehavior: 'output' },
  { code: '2200', parent: '213', subtype: 'accrued_liability' },
  { code: '2300', parent: '214', subtype: 'accrued_liability' },
  { code: '2400', parent: '212', subtype: 'tax_liability' },
  { code: '2500', parent: '25', subtype: 'long_term_liability' },

  // equity
  { code: '3000', parent: '31', subtype: 'capital' },
  { code: '3100', parent: '32', subtype: 'retained_earnings' },

  // revenue
  { code: '4000', parent: '41', subtype: 'operating_revenue' },
  // CORRECTION: sales returns is CONTRA-REVENUE (debit balance), not revenue
  { code: '4200', parent: '49', subtype: 'contra_revenue', normalBalance: 'debit' },
  // CORRECTION: "other revenue" is non-operating -> class other_income (ledger type stays 'income')
  { code: '4100', parent: '71', accountClass: 'other_income', subtype: 'other_revenue' },

  // cost of sales
  { code: '5000', parent: '51', subtype: 'cogs' },
  { code: '5100', parent: '52', subtype: 'purchases' },
  { code: '5200', parent: '53', subtype: 'manufacturing_overhead' },

  // operating expenses
  { code: '6000', parent: '61', subtype: 'payroll_expense' },
  { code: '6100', parent: '62', subtype: 'rent_expense' },
  { code: '6200', parent: '62', subtype: 'utilities_expense' },
  { code: '6300', parent: '62', subtype: 'operating_expense' },
  { code: '6400', parent: '63', subtype: 'depreciation_expense' },
  { code: '6500', parent: '62', subtype: 'administrative_expense' },
]

/** Accounts the re-engineered chart needs that did not exist before. */
const NEW_ACCOUNTS = [
  { code: '1900', nameAr: 'حساب وسيط معلق', nameEn: 'Suspense Account', accountClass: 'asset', parent: '119', subtype: 'other_asset' },
  { code: '2210', nameAr: 'استقطاعات الرواتب المستحقة', nameEn: 'Payroll Deductions Payable', accountClass: 'liability', parent: '213', subtype: 'accrued_liability' },
  { code: '3200', nameAr: 'أرباح السنة الحالية', nameEn: 'Current Year Earnings', accountClass: 'equity', parent: '32', subtype: 'current_year_earnings' },
  { code: '3900', nameAr: 'حساب الأرصدة الافتتاحية', nameEn: 'Opening Balance Account', accountClass: 'equity', parent: '32', subtype: 'other_equity' },
  { code: '4300', nameAr: 'خصم مسموح على المبيعات', nameEn: 'Sales Discount Allowed', accountClass: 'revenue', parent: '49', subtype: 'contra_revenue', normalBalance: 'debit' },
  { code: '5190', nameAr: 'مردودات ومسموحات المشتريات', nameEn: 'Purchase Returns & Allowances', accountClass: 'cogs', parent: '52', subtype: 'contra_purchases', normalBalance: 'credit' },
  { code: '7100', nameAr: 'أرباح فروق العملة', nameEn: 'FX Gain', accountClass: 'other_income', parent: '71', subtype: 'fx_gain' },
  { code: '7200', nameAr: 'أرباح تسوية المخزون', nameEn: 'Inventory Surplus Gain', accountClass: 'other_income', parent: '71', subtype: 'other_revenue' },
  { code: '8100', nameAr: 'خسائر فروق العملة', nameEn: 'FX Loss', accountClass: 'other_expense', parent: '81', subtype: 'fx_loss' },
  { code: '8200', nameAr: 'فروق التقريب', nameEn: 'Rounding Difference', accountClass: 'other_expense', parent: '81', subtype: 'other_expense' },
  { code: '8300', nameAr: 'خسائر تسوية المخزون', nameEn: 'Inventory Shortage Loss', accountClass: 'other_expense', parent: '81', subtype: 'other_expense' },
]

/** role -> account code. The resolver reads this table, never hardcoded codes. */
const ROLE_MAP = {
  CASH: '1000',
  BANK: '1020',
  CUSTOMER_RECEIVABLE: '1100',
  INVENTORY: '1200',
  RAW_MATERIALS: '1210',
  FINISHED_GOODS: '1220',
  WIP: '1230',
  TAX_RECEIVABLE: '1400',
  ASSET: '1500',
  ACCUMULATED_DEPRECIATION: '1590',
  SUSPENSE: '1900',
  SUPPLIER_PAYABLE: '2000',
  TAX_PAYABLE: '2100',
  SALARIES_PAYABLE: '2200',
  PAYROLL_DEDUCTIONS_PAYABLE: '2210',
  GRNI: '2300',
  RETAINED_EARNINGS: '3100',
  CURRENT_YEAR_EARNINGS: '3200',
  OPENING_BALANCE: '3900',
  SALES: '4000',
  SALES_RETURN: '4200',
  SALES_DISCOUNT: '4300',
  COGS: '5000',
  PURCHASE: '5100',
  PURCHASE_RETURN: '5190',
  PRODUCTION_COST: '5200',
  PAYROLL: '6000',
  DEPRECIATION: '6400',
  OTHER_REVENUE: '4100',
  FX_GAIN: '7100',
  INVENTORY_GAIN: '7200',
  FX_LOSS: '8100',
  ROUNDING: '8200',
  INVENTORY_LOSS: '8300',
}

const CLASS_DEFAULTS = {
  asset: { type: 'asset', normalBalance: 'debit', fsSection: 'balance_sheet' },
  liability: { type: 'liability', normalBalance: 'credit', fsSection: 'balance_sheet' },
  equity: { type: 'equity', normalBalance: 'credit', fsSection: 'balance_sheet' },
  revenue: { type: 'income', normalBalance: 'credit', fsSection: 'income_statement' },
  cogs: { type: 'expense', normalBalance: 'debit', fsSection: 'income_statement' },
  operating_expense: { type: 'expense', normalBalance: 'debit', fsSection: 'income_statement' },
  other_income: { type: 'income', normalBalance: 'credit', fsSection: 'income_statement' },
  other_expense: { type: 'expense', normalBalance: 'debit', fsSection: 'income_statement' },
}

// RBAC catalog for the Chart of Accounts (module FIN).
const PERMISSIONS = [
  { actionCode: 'COA', nameAr: 'دليل الحسابات', nameEn: 'Chart of Accounts', riskLevel: 'high', requiresAudit: true },
  { actionCode: 'COA_LEDGER', nameAr: 'دفتر أستاذ الحساب', nameEn: 'Account Ledger', riskLevel: 'medium', requiresAudit: false },
  { actionCode: 'COA_CONFIG', nameAr: 'تحديد الحسابات', nameEn: 'Account Determination', riskLevel: 'critical', requiresAudit: true },
]

const ROLE_GRANTS = {
  ADMIN: { COA: 'all', COA_LEDGER: 'all', COA_CONFIG: 'all' },
  FIN_MGR: { COA: 'all', COA_LEDGER: 'all', COA_CONFIG: 'all' },
  CHIEF_ACC: {
    COA: { canRead: true, canCreate: true, canUpdate: true, canDelete: true, canImport: true, canExport: true, canPrint: true },
    COA_LEDGER: { canRead: true, canPrint: true },
    COA_CONFIG: { canRead: true, canUpdate: true },
  },
  ACCOUNTANT: {
    COA: { canRead: true, canCreate: true, canUpdate: true, canExport: true, canPrint: true },
    COA_LEDGER: { canRead: true, canPrint: true },
    COA_CONFIG: { canRead: true },
  },
  CEO: { COA: { canRead: true, canExport: true, canPrint: true }, COA_LEDGER: { canRead: true }, COA_CONFIG: { canRead: true } },
  AUDITOR: { COA: { canRead: true, canExport: true, canPrint: true }, COA_LEDGER: { canRead: true }, COA_CONFIG: { canRead: true } },
  CASHIER: { COA: { canRead: true }, COA_LEDGER: { canRead: true } },
  VIEWER: { COA: { canRead: true } },
}

const ALL_CAPS = {
  canRead: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true,
  canPost: true, canCancel: true, canReverse: true, canPrint: true, canExport: true, canImport: true,
}

async function main() {
  log('\n=== Chart of Accounts migration ===')
  log(DRY_RUN ? 'MODE: dry-run (no writes)\n' : 'MODE: apply\n')

  const report = {
    groupsCreated: [], accountsCreated: [], reparented: [], reclassified: [],
    contraFixed: [], rolesMapped: [], permissionsCreated: [], grants: 0,
    skipped: [], warnings: [],
  };

  // ---- preflight -------------------------------------------------------
  const before = await db.account.findMany({
    include: { _count: { select: { journalLines: true, children: true } } },
  })
  log(`Existing accounts: ${before.length}`)
  const byCode = new Map(before.map((a) => [a.code, a]))
  const postingsByCode = new Map(before.map((a) => [a.code, a._count.journalLines]))

  // Refuse to turn an account that already has postings into a group.
  for (const g of GROUPS) {
    const clash = byCode.get(g.code)
    if (clash && (postingsByCode.get(g.code) ?? 0) > 0) {
      report.warnings.push(
        `code ${g.code} already exists as a POSTING account with ${postingsByCode.get(g.code)} journal line(s); it will NOT be converted to a group.`
      )
    }
  }

  const runner = async (tx) => {
    const codeToId = new Map(before.map((a) => [a.code, a.id]))

    // ---- 1. group skeleton (create or align) --------------------------
    for (const g of GROUPS) {
      const defaults = CLASS_DEFAULTS[g.accountClass]
      const existing = byCode.get(g.code)
      const hasPostings = (postingsByCode.get(g.code) ?? 0) > 0

      if (existing && hasPostings) {
        report.skipped.push(`group ${g.code}: existing posting account with history — left as a posting account`)
        continue
      }

      const data = {
        nameAr: g.nameAr,
        nameEn: g.nameEn,
        accountClass: g.accountClass,
        type: defaults.type,
        subtype: g.subtype ?? null,
        isPosting: false,
        isSystem: true,
        normalBalance: defaults.normalBalance,
        fsSection: defaults.fsSection,
        allowManualEntry: false,
        active: true,
      }

      if (existing) {
        if (!DRY_RUN) await tx.account.update({ where: { id: existing.id }, data })
        codeToId.set(g.code, existing.id)
      } else {
        if (DRY_RUN) {
          codeToId.set(g.code, `dry-${g.code}`)
        } else {
          const row = await tx.account.create({ data: { ...data, code: g.code } })
          codeToId.set(g.code, row.id)
        }
        report.groupsCreated.push(`${g.code} ${g.nameAr}`)
      }
    }

    // link groups to their parents (second pass — all ids now known)
    for (const g of GROUPS) {
      if (!g.parent) continue
      const id = codeToId.get(g.code)
      const parentId = codeToId.get(g.parent)
      if (!id || !parentId || DRY_RUN) continue
      await tx.account.update({ where: { id }, data: { parentId } })
    }

    // ---- 2. new posting accounts --------------------------------------
    for (const a of NEW_ACCOUNTS) {
      const defaults = CLASS_DEFAULTS[a.accountClass]
      const existing = byCode.get(a.code)
      const data = {
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        accountClass: a.accountClass,
        type: defaults.type,
        subtype: a.subtype ?? null,
        parentId: codeToId.get(a.parent) ?? null,
        isPosting: true,
        isSystem: true,
        normalBalance: a.normalBalance ?? defaults.normalBalance,
        fsSection: defaults.fsSection,
        active: true,
      }
      if (existing) {
        if (!DRY_RUN) await tx.account.update({ where: { id: existing.id }, data })
        codeToId.set(a.code, existing.id)
      } else {
        if (DRY_RUN) {
          codeToId.set(a.code, `dry-${a.code}`)
        } else {
          const row = await tx.account.create({ data: { ...data, code: a.code } })
          codeToId.set(a.code, row.id)
        }
        report.accountsCreated.push(`${a.code} ${a.nameAr}`)
      }
    }

    // ---- 3. re-parent + correct existing accounts ---------------------
    for (const r of REPARENT) {
      const existing = byCode.get(r.code)
      if (!existing) {
        report.skipped.push(`reparent ${r.code}: account not present in this database`)
        continue
      }
      const targetClass = r.accountClass ?? existing.accountClass
      const defaults = CLASS_DEFAULTS[targetClass]
      if (!defaults) {
        report.warnings.push(`reparent ${r.code}: unknown class ${targetClass}`)
        continue
      }

      // A class change is only safe when the ledger primitive stays identical.
      if (r.accountClass && r.accountClass !== existing.accountClass) {
        if (defaults.type !== existing.type) {
          report.warnings.push(
            `reparent ${r.code}: refused class change ${existing.accountClass} -> ${r.accountClass} because ledger type would change (${existing.type} -> ${defaults.type})`
          )
          continue
        }
        report.reclassified.push(`${r.code}: ${existing.accountClass} -> ${r.accountClass} (ledger type unchanged: ${existing.type})`)
      }

      const normalBalance = r.normalBalance ?? defaults.normalBalance
      if (normalBalance !== existing.normalBalance) {
        report.contraFixed.push(
          `${r.code} ${existing.nameAr}: normalBalance ${existing.normalBalance} -> ${normalBalance} (presentation sign only; journal lines untouched)`
        )
      }

      const parentId = codeToId.get(r.parent) ?? null
      if (existing.parentId !== parentId) report.reparented.push(`${r.code} -> parent ${r.parent}`)

      if (!DRY_RUN) {
        await tx.account.update({
          where: { id: existing.id },
          data: {
            parentId,
            accountClass: targetClass,
            type: defaults.type,
            subtype: r.subtype ?? existing.subtype,
            normalBalance,
            fsSection: defaults.fsSection,
            allowReconciliation: r.allowReconciliation ?? existing.allowReconciliation,
            taxBehavior: r.taxBehavior ?? existing.taxBehavior,
            isPosting: true, // any account with history must stay postable
            isSystem: true,
          },
        })
      }
    }

    // ---- 4. materialized path / level --------------------------------
    if (!DRY_RUN) {
      const all = await tx.account.findMany({ select: { id: true, parentId: true } })
      const childrenOf = new Map()
      for (const a of all) {
        if (!a.parentId) continue
        const arr = childrenOf.get(a.parentId) ?? []
        arr.push(a.id)
        childrenOf.set(a.parentId, arr)
      }
      const walk = async (id, basePath, level, guard) => {
        if (guard.has(id)) return
        guard.add(id)
        const path = `${basePath}/${id}`
        await tx.account.update({ where: { id }, data: { path, level } })
        for (const c of childrenOf.get(id) ?? []) await walk(c, path, level + 1, guard)
        guard.delete(id)
      }
      for (const root of all.filter((a) => !a.parentId)) await walk(root.id, '', 0, new Set())
    }

    // ---- 5. account determination -----------------------------------
    for (const [role, code] of Object.entries(ROLE_MAP)) {
      const accountId = codeToId.get(code)
      if (!accountId) {
        report.warnings.push(`role ${role}: target account ${code} not found — role left unmapped`)
        continue
      }
      if (!DRY_RUN) {
        await tx.accountRoleMapping.upsert({
          where: { companyId_branchId_role: { companyId: '*', branchId: '*', role } },
          create: { companyId: '*', branchId: '*', role, accountId, active: true, createdBy: 'migration' },
          update: { accountId, active: true, updatedBy: 'migration' },
        })
      }
      report.rolesMapped.push(`${role} -> ${code}`)
    }

    // ---- 6. RBAC catalog --------------------------------------------
    const permIds = {}
    for (const p of PERMISSIONS) {
      let perm = await tx.permission.findFirst({ where: { moduleCode: 'FIN', actionCode: p.actionCode } })
      if (!perm && !DRY_RUN) {
        perm = await tx.permission.create({
          data: { moduleCode: 'FIN', actionCode: p.actionCode, nameAr: p.nameAr, nameEn: p.nameEn, riskLevel: p.riskLevel, requiresAudit: p.requiresAudit, active: true },
        })
        report.permissionsCreated.push(p.actionCode)
      }
      if (perm) permIds[p.actionCode] = perm.id
    }

    const ROLE_DEFS = {
      ADMIN: { nameAr: 'مدير النظام', nameEn: 'System Administrator' },
      FIN_MGR: { nameAr: 'المدير المالي', nameEn: 'Finance Manager' },
      CHIEF_ACC: { nameAr: 'رئيس الحسابات', nameEn: 'Chief Accountant' },
      ACCOUNTANT: { nameAr: 'محاسب', nameEn: 'Accountant' },
      CEO: { nameAr: 'المدير التنفيذي', nameEn: 'Chief Executive Officer' },
      AUDITOR: { nameAr: 'مراجع مالي', nameEn: 'Financial Auditor' },
      CASHIER: { nameAr: 'أمين صندوق', nameEn: 'Cashier' },
      VIEWER: { nameAr: 'مستطلع / عرض فقط', nameEn: 'Viewer' },
    }

    for (const [roleCode, grants] of Object.entries(ROLE_GRANTS)) {
      let role = await tx.role.findUnique({ where: { code: roleCode } })
      if (!role && !DRY_RUN) {
        const def = ROLE_DEFS[roleCode] || { nameAr: roleCode, nameEn: roleCode }
        role = await tx.role.create({
          data: { code: roleCode, nameAr: def.nameAr, nameEn: def.nameEn, isSystem: true, active: true },
        })
      }
      if (!role && DRY_RUN) {
        for (const [action] of Object.entries(grants)) {
          if (permIds[action]) report.grants++
        }
        continue
      }
      if (!role) {
        report.warnings.push(`RBAC: role ${roleCode} not found — grants skipped`)
        continue
      }
      for (const [action, caps] of Object.entries(grants)) {
        const permissionId = permIds[action]
        if (!permissionId) continue
        const capabilities = caps === 'all' ? ALL_CAPS : caps
        const existing = await tx.rolePermission.findFirst({ where: { roleId: role.id, permissionId } })
        if (DRY_RUN) { report.grants++; continue }
        if (existing) {
          await tx.rolePermission.update({ where: { id: existing.id }, data: { ...capabilities, dataScope: 'company' } })
        } else {
          await tx.rolePermission.create({ data: { roleId: role.id, permissionId, ...capabilities, dataScope: 'company' } })
        }
        report.grants++
      }
    }
  }

  if (DRY_RUN) {
    await runner(db)
  } else {
    await db.$transaction(runner, { timeout: 180_000 })
  }

  // ---- verification ---------------------------------------------------
  log('\n--- Verification ---')
  const groupsWithPostings = await db.$queryRawUnsafe(`
    SELECT a."code", a."nameAr", COUNT(jl."id")::int AS lines
    FROM "Account" a JOIN "JournalLine" jl ON jl."accountId" = a."id"
    WHERE a."isPosting" = false GROUP BY a."code", a."nameAr"`)
  const orphans = await db.$queryRawUnsafe(`
    SELECT a."code" FROM "Account" a
    WHERE a."parentId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Account" p WHERE p."id" = a."parentId")`)
  const missingPath = await db.account.count({ where: { path: null } })
  const classMismatch = await db.$queryRawUnsafe(`
    SELECT c."code" AS child, p."code" AS parent, c."accountClass" AS child_class, p."accountClass" AS parent_class
    FROM "Account" c JOIN "Account" p ON c."parentId" = p."id"
    WHERE c."accountClass" <> p."accountClass"`)
  const unbalanced = await db.$queryRawUnsafe(`
    SELECT je."code", je."totalDebit", je."totalCredit"
    FROM "JournalEntry" je
    WHERE ABS(je."totalDebit" - je."totalCredit") > 0.01 LIMIT 20`)

  const summary = {
    groupsCreated: report.groupsCreated.length,
    accountsCreated: report.accountsCreated.length,
    reparented: report.reparented.length,
    reclassified: report.reclassified.length,
    contraBalanceFixes: report.contraFixed.length,
    rolesMapped: report.rolesMapped.length,
    permissionsCreated: report.permissionsCreated.length,
    roleGrants: report.grants,
    checks: {
      groupAccountsWithPostings: groupsWithPostings.length,
      orphanAccounts: orphans.length,
      accountsMissingPath: missingPath,
      parentChildClassMismatch: classMismatch.length,
      unbalancedJournalEntries: unbalanced.length,
    },
  }

  log(JSON.stringify(summary, null, 2))

  if (report.reclassified.length) { log('\nReclassified:'); report.reclassified.forEach((r) => log('  •', r)) }
  if (report.contraFixed.length) { log('\nContra-account presentation fixes:'); report.contraFixed.forEach((r) => log('  •', r)) }
  if (report.skipped.length) { log('\nSkipped:'); report.skipped.forEach((r) => log('  •', r)) }
  if (report.warnings.length) { log('\nWarnings:'); report.warnings.forEach((r) => warn(r)) }
  if (groupsWithPostings.length) { log('\n⚠ Group accounts carrying postings (must be fixed manually):'); console.table(groupsWithPostings) }
  if (unbalanced.length) { log('\n⚠ Pre-existing unbalanced journal entries (not caused by this migration):'); console.table(unbalanced) }

  log(DRY_RUN ? '\n✔ Dry run complete — nothing was written.' : '\n✔ Migration applied.')
}

// The migration tables are exported so tests can assert that the target chart
// and the role mappings stay consistent with the code's role catalog.
export { GROUPS, REPARENT, NEW_ACCOUNTS, ROLE_MAP, CLASS_DEFAULTS, PERMISSIONS, ROLE_GRANTS }

// Only run when executed directly (`node scripts/migrate-chart-of-accounts.mjs`),
// so importing this file for tests has no side effects.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  main()
    .catch((e) => { console.error('\n✖ Migration failed — transaction rolled back.\n', e); process.exit(1) })
    .finally(() => db.$disconnect())
}
