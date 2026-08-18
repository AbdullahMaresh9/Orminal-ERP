// Enterprise ERP — Central Posting Engine
// Source: ADR-002 Ledger-Centric Posting, ADR-018 Draft→Post→Reverse
// Source: ADR-CoA-001 Account Determination (no hardcoded account codes)
//
// All accounting postings MUST go through this engine. No module posts directly.
// Posted journal entries are IMMUTABLE. Corrections use reversal only.
//
// Re-engineered as part of the Chart of Accounts overhaul:
//   1. Lines address accounts by semantic ROLE; determination happens here.
//   2. The whole posting (entry + lines + cached balances + audit) runs inside a
//      single Prisma $transaction — no more half-posted state on failure.
//   3. Posting guards: group accounts, inactive accounts and closed periods are
//      rejected before anything is written.
//   4. Cached Account.balance is updated once per account (was: findUnique +
//      update per line → N+1).
//   5. Dimension rules (requireCostCenter/Branch/Project) are enforced.

import { db } from '@/lib/db'
import { nextNumber } from './number-sequence'
import { resolveAccounts } from './account-determination'
import { signedBalance } from './account-classes'
import type { AccountRole } from './account-roles'

/**
 * @deprecated Account codes must not be referenced from business logic.
 * Kept only so legacy call sites keep compiling; use `role` on the line instead.
 * The values mirror the default chart shipped by the migration script.
 */
export const SYSTEM_ACCOUNTS = {
  CASH: '1000',
  CASH_SAFE: '1010',
  CASH_BANK: '1020',
  AR: '1100',
  INVENTORY: '1200',
  RAW_MATERIALS: '1210',
  FINISHED_GOODS: '1220',
  WIP: '1230',
  INPUT_VAT: '1400',
  FIXED_ASSETS: '1500',
  ACC_DEPRECIATION: '1590',
  AP: '2000',
  OUTPUT_VAT: '2100',
  SALARIES_PAYABLE: '2200',
  GRNI: '2300',
  CAPITAL: '3000',
  RETAINED_EARNINGS: '3100',
  SALES_REVENUE: '4000',
  OTHER_REVENUE: '4100',
  SALES_RETURNS: '4200',
  COGS: '5000',
  PURCHASES: '5100',
  PRODUCTION_COST: '5200',
  SALARIES_EXPENSE: '6000',
  RENT: '6100',
  UTILITIES: '6200',
  OPERATING_EXPENSES: '6300',
  DEPRECIATION_EXPENSE: '6400',
  ADMIN_EXPENSES: '6500',
} as const

// System account definitions and fallback dictionary
export const SYSTEM_ACCOUNT_DEFS: Record<string, { nameAr: string; nameEn: string; type: string; subtype: string }> = {
  '1000': { nameAr: 'النقدية', nameEn: 'Cash', type: 'asset', subtype: 'current_asset' },
  '1010': { nameAr: 'النقدية - الصندوق', nameEn: 'Cash - Safe', type: 'asset', subtype: 'current_asset' },
  '1020': { nameAr: 'النقدية - البنك', nameEn: 'Cash - Bank', type: 'asset', subtype: 'current_asset' },
  '1100': { nameAr: 'الذمم المدينة', nameEn: 'Accounts Receivable', type: 'asset', subtype: 'current_asset' },
  '1110': { nameAr: 'الذمم المدينة - العملاء', nameEn: 'Accounts Receivable - Customers', type: 'asset', subtype: 'current_asset' },
  '1200': { nameAr: 'المخزون', nameEn: 'Inventory', type: 'asset', subtype: 'current_asset' },
  '1210': { nameAr: 'المواد الخام', nameEn: 'Raw Materials', type: 'asset', subtype: 'current_asset' },
  '1220': { nameAr: 'البضائع الجاهزة', nameEn: 'Finished Goods', type: 'asset', subtype: 'current_asset' },
  '1230': { nameAr: 'تحت التشغيل', nameEn: 'Work in Process', type: 'asset', subtype: 'current_asset' },
  '1300': { nameAr: 'الراتب المقدم', nameEn: 'Prepaid Expenses', type: 'asset', subtype: 'current_asset' },
  '1400': { nameAr: 'ضريبة القيمة المضافة القابلة للخصم', nameEn: 'Input VAT', type: 'asset', subtype: 'current_asset' },
  '1500': { nameAr: 'الأصول الثابتة', nameEn: 'Fixed Assets', type: 'asset', subtype: 'fixed_asset' },
  '1510': { nameAr: 'الأثاث والمعدات', nameEn: 'Furniture & Equipment', type: 'asset', subtype: 'fixed_asset' },
  '1520': { nameAr: 'المركبات', nameEn: 'Vehicles', type: 'asset', subtype: 'fixed_asset' },
  '1590': { nameAr: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation', type: 'asset', subtype: 'fixed_asset' },
  '2000': { nameAr: 'الذمم الدائنة', nameEn: 'Accounts Payable', type: 'liability', subtype: 'current_liability' },
  '2100': { nameAr: 'ضريبة القيمة المضافة المستحقة', nameEn: 'Output VAT', type: 'liability', subtype: 'current_liability' },
  '2200': { nameAr: 'الرواتب المستحقة', nameEn: 'Salaries Payable', type: 'liability', subtype: 'current_liability' },
  '2300': { nameAr: 'بضاعة مستلمة غير مفوتر', nameEn: 'GRNI', type: 'liability', subtype: 'current_liability' },
  '2400': { nameAr: 'ضريبة الدخل المستحقة', nameEn: 'Income Tax Payable', type: 'liability', subtype: 'current_liability' },
  '2500': { nameAr: 'قروض طويلة الأجل', nameEn: 'Long-term Loans', type: 'liability', subtype: 'long_term_liability' },
  '3000': { nameAr: 'رأس المال', nameEn: 'Owner Capital', type: 'equity', subtype: 'capital' },
  '3100': { nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings' },
  '4000': { nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'income', subtype: 'operating_revenue' },
  '4100': { nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', type: 'income', subtype: 'other_revenue' },
  '4200': { nameAr: 'مرتجع المبيعات', nameEn: 'Sales Returns', type: 'income', subtype: 'operating_revenue' },
  '5000': { nameAr: 'تكلفة البضاعة المباعة', nameEn: 'COGS', type: 'expense', subtype: 'cogs' },
  '5100': { nameAr: 'المشتريات', nameEn: 'Purchases', type: 'expense', subtype: 'cogs' },
  '5200': { nameAr: 'تكلفة الإنتاج', nameEn: 'Production Cost', type: 'expense', subtype: 'cogs' },
  '6000': { nameAr: 'الرواتب والأجور', nameEn: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense' },
  '6100': { nameAr: 'الإيجار', nameEn: 'Rent', type: 'expense', subtype: 'operating_expense' },
  '6200': { nameAr: 'الكهرباء والمياه', nameEn: 'Utilities', type: 'expense', subtype: 'operating_expense' },
  '6300': { nameAr: 'مصاريف تشغيلية', nameEn: 'Operating Expenses', type: 'expense', subtype: 'operating_expense' },
  '6400': { nameAr: 'الإهلاك', nameEn: 'Depreciation Expense', type: 'expense', subtype: 'operating_expense' },
  '6500': { nameAr: 'مصاريف إدارية', nameEn: 'Administrative Expenses', type: 'expense', subtype: 'operating_expense' },
}

export interface JournalLineInput {
  /** Preferred: semantic role resolved through account determination. */
  role?: AccountRole
  /** Legacy/manual: explicit account code. */
  accountCode?: string
  /** Manual journal entries from the UI address accounts by id. */
  accountId?: string
  debit: number
  credit: number
  description?: string
  partnerId?: string
  costCenterId?: string
  analyticAccountId?: string
  taxCodeId?: string
}

export interface PostEntryInput {
  companyId: string
  branchId?: string
  journalType?: string // sale|purchase|cash|bank|general|opening|closing
  postingDate?: Date
  description: string
  refType?: string
  refId?: string
  currencyId?: string
  lines: JournalLineInput[]
  userId?: string
}

const CENTS = 0.01

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

// Validate that debit total === credit total (BR-FIN-001)
export function validateBalanced(lines: JournalLineInput[]): boolean {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  return Math.abs(round2(totalDebit) - round2(totalCredit)) < CENTS
}

feat/coa-reengineering-and-db-hardening
interface AccountRow {
  id: string
  code: string
  nameAr: string
  isPosting: boolean
  active: boolean
  normalBalance: string
  requireCostCenter: boolean
  requireBranch: boolean
  requireProject: boolean
  allowManualEntry: boolean
}

const ACCOUNT_SELECT = {
  id: true,
  code: true,
  nameAr: true,
  isPosting: true,
  active: true,
  normalBalance: true,
  requireCostCenter: true,
  requireBranch: true,
  requireProject: true,
  allowManualEntry: true,
} as const

/**
 * Turn every line into a concrete, validated account id.
 * Resolution: role -> determination table; accountId / accountCode -> direct lookup.
 */
async function resolveLineAccounts(input: PostEntryInput): Promise<{ accountIds: string[]; accounts: Map<string, AccountRow> }> {
  const roles = input.lines.map((l) => l.role).filter((r): r is AccountRole => Boolean(r))
  const codes = input.lines.map((l) => l.accountCode).filter((c): c is string => Boolean(c))
  const ids = input.lines.map((l) => l.accountId).filter((i): i is string => Boolean(i))

  const roleMap = roles.length
    ? await resolveAccounts(roles, { companyId: input.companyId, branchId: input.branchId })
    : new Map()

  const directWhere: any[] = []
  if (codes.length) directWhere.push({ code: { in: codes } })
  if (ids.length) directWhere.push({ id: { in: ids } })
  const roleAccountIds = [...roleMap.values()].map((v) => v.id)
  if (roleAccountIds.length) directWhere.push({ id: { in: roleAccountIds } })

  const direct = directWhere.length
    ? await db.account.findMany({ where: { OR: directWhere }, select: ACCOUNT_SELECT })
    : []
  const byCode = new Map(direct.map((a) => [a.code, a as AccountRow]))
  const byId = new Map(direct.map((a) => [a.id, a as AccountRow]))

  const accountIds: string[] = []
  const accounts = new Map<string, AccountRow>()

  for (const [index, line] of input.lines.entries()) {
    let row: AccountRow | undefined
    if (line.role) {
      const resolved = roleMap.get(line.role)
      row = resolved ? byId.get(resolved.id) : undefined
      if (!row) throw new Error(`ACCOUNT_ROLE_UNRESOLVED: ${line.role}`)
    } else if (line.accountId) {
      row = byId.get(line.accountId)
      if (!row) throw new Error(`ACCOUNT_NOT_FOUND: ${line.accountId}`)
    } else if (line.accountCode) {
      row = byCode.get(line.accountCode)
      if (!row) throw new Error(`ACCOUNT_NOT_FOUND: ${line.accountCode}`)
    } else {
      throw new Error(`JOURNAL_LINE_NO_ACCOUNT: السطر ${index + 1} بلا حساب (role أو accountId أو accountCode مطلوب)`)
    }

    // --- posting guards (BR-COA-001..003) ---
    if (!row.isPosting) {
      throw new Error(`POSTING_TO_GROUP_ACCOUNT: لا يمكن الترحيل على حساب مجمّع (${row.code} — ${row.nameAr})`)
    }
    if (!row.active) {
      throw new Error(`POSTING_TO_INACTIVE_ACCOUNT: لا يمكن الترحيل على حساب غير نشط (${row.code} — ${row.nameAr})`)
    }
    // --- dimension rules (dimensional accounting, not per-dimension accounts) ---
    if (row.requireCostCenter && !line.costCenterId) {
      throw new Error(`DIMENSION_REQUIRED_COST_CENTER: الحساب ${row.code} يتطلب مركز تكلفة`)
    }
    if (row.requireBranch && !input.branchId) {
      throw new Error(`DIMENSION_REQUIRED_BRANCH: الحساب ${row.code} يتطلب تحديد الفرع`)
    }
    if (row.requireProject && !line.analyticAccountId) {
      throw new Error(`DIMENSION_REQUIRED_PROJECT: الحساب ${row.code} يتطلب مشروعاً/حساباً تحليلياً`)
    }

    accountIds.push(row.id)
    accounts.set(row.id, row)
  }

  return { accountIds, accounts }

// Resolve account codes to account IDs (with auto-creation fallback for missing system accounts)
async function resolveAccounts(lines: JournalLineInput[]): Promise<Map<string, string>> {
  const codes = [...new Set(lines.map((l) => l.accountCode))]
  const accounts = await db.account.findMany({ where: { code: { in: codes } } })
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]))

  for (const code of codes) {
    if (!accountMap.has(code)) {
      const def = SYSTEM_ACCOUNT_DEFS[code]
      if (def) {
        const created = await db.account.upsert({
          where: { code },
          update: {},
          create: {
            code,
            nameAr: def.nameAr,
            nameEn: def.nameEn,
            type: def.type,
            subtype: def.subtype,
            isSystem: true,
          },
        })
        accountMap.set(code, created.id)
      }
    }
  }

  return accountMap
     main
}

// === Central post function — creates a posted journal entry atomically ===
export async function postJournalEntry(input: PostEntryInput): Promise<{ id: string; code: string }> {
  // BR-FIN-001: Validate balanced
  if (!validateBalanced(input.lines)) {
    const d = round2(input.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0))
    const c = round2(input.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0))
    throw new Error(`UNBALANCED_JOURNAL: debit (${d}) != credit (${c})`)
  }
  if (input.lines.length < 2) {
    throw new Error('JOURNAL_MIN_LINES: at least 2 lines required')
  }
  for (const [i, l] of input.lines.entries()) {
    const d = Number(l.debit) || 0
    const c = Number(l.credit) || 0
    if (d < 0 || c < 0) throw new Error(`JOURNAL_NEGATIVE_AMOUNT: السطر ${i + 1} يحتوي مبلغاً سالباً`)
    if (d > 0 && c > 0) throw new Error(`JOURNAL_LINE_BOTH_SIDES: السطر ${i + 1} لا يمكن أن يكون مديناً ودائناً معاً`)
  }

 feat/coa-reengineering-and-db-hardening
  // Resolve + guard every account before writing anything.
  const { accountIds, accounts } = await resolveLineAccounts(input)

  // Find journal by type
  let journalId: string | undefined

  // Find journal by type (with auto-creation fallback)
  let journal: any = null
     main
  if (input.journalType) {
    const journalMap: Record<string, string> = {
      sale: 'SJ', purchase: 'PJ', cash: 'CJ', bank: 'BJ', general: 'GJ', opening: 'OJ', closing: 'CLJ',
    }
 feat/coa-reengineering-and-db-hardening
    const journal = await db.journal.findUnique({ where: { code: journalMap[input.journalType] || 'GJ' } })
    journalId = journal?.id

    const targetCode = journalMap[input.journalType] || 'GJ'
    journal = await db.journal.findUnique({ where: { code: targetCode } })
    if (!journal) {
      const journalDefs: Record<string, { nameAr: string; nameEn: string; type: string }> = {
        SJ: { nameAr: 'يومية المبيعات', nameEn: 'Sales Journal', type: 'sale' },
        PJ: { nameAr: 'يومية المشتريات', nameEn: 'Purchase Journal', type: 'purchase' },
        CJ: { nameAr: 'يومية النقدية', nameEn: 'Cash Journal', type: 'cash' },
        BJ: { nameAr: 'يومية البنك', nameEn: 'Bank Journal', type: 'bank' },
        GJ: { nameAr: 'يومية عامة', nameEn: 'General Journal', type: 'general' },
        OJ: { nameAr: 'يومية افتتاحية', nameEn: 'Opening Journal', type: 'opening' },
        CLJ: { nameAr: 'يومية الإقفال', nameEn: 'Closing Journal', type: 'closing' },
      }
      const def = journalDefs[targetCode] || journalDefs['GJ']
      journal = await db.journal.upsert({
        where: { code: targetCode },
        update: {},
        create: { code: targetCode, nameAr: def.nameAr, nameEn: def.nameEn, type: def.type },
      })
    }
     main
  }

  // Find fiscal period for posting date
  const postingDate = input.postingDate ?? new Date()
  const fiscalPeriod = await db.fiscalPeriod.findFirst({
    where: { startDate: { lte: postingDate }, endDate: { gte: postingDate } },
  })

  // BR-FIN-002: Check period open
  if (fiscalPeriod && fiscalPeriod.state === 'closed') {
    throw new Error('PERIOD_CLOSED: posting date is in a closed period')
  }

  const code = await nextNumber('journal_entry', input.companyId, input.branchId, postingDate.getFullYear())

  const totalDebit = round2(input.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0))
  const totalCredit = round2(input.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0))

  // Aggregate the cached-balance delta per account (one update per account).
  const deltaByAccount = new Map<string, number>()
  input.lines.forEach((line, i) => {
    const accountId = accountIds[i]
    const nb = accounts.get(accountId)?.normalBalance ?? 'debit'
    const delta = signedBalance(nb, Number(line.debit) || 0, Number(line.credit) || 0)
    deltaByAccount.set(accountId, round2((deltaByAccount.get(accountId) ?? 0) + delta))
  })

  // === Everything below is atomic: entry + lines + balances + audit ===
  const entry = await db.$transaction(async (tx) => {
    const createdEntry = await tx.journalEntry.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        code,
        journalId,
        postingDate,
        description: input.description,
        refType: input.refType,
        refId: input.refId,
        currencyId: input.currencyId,
        state: 'posted',
        totalDebit,
        totalCredit,
        fiscalPeriodId: fiscalPeriod?.id,
        createdBy: input.userId,
        postedBy: input.userId,
        lines: {
          create: input.lines.map((l, i) => ({
            accountId: accountIds[i],
            partnerId: l.partnerId,
            debit: round2(l.debit),
            credit: round2(l.credit),
            description: l.description,
            costCenterId: l.costCenterId,
            analyticAccountId: l.analyticAccountId,
            taxCodeId: l.taxCodeId,
          })),
        },
      },
    })

    for (const [accountId, delta] of deltaByAccount) {
      if (delta === 0) continue
      await tx.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } })
    }

    if (input.userId) {
      await tx.auditLog.create({
        data: {
          userId: input.userId,
          companyId: input.companyId,
          moduleCode: 'FIN',
          documentType: 'journal_entry',
          documentId: createdEntry.id,
          action: 'post',
          newValue: JSON.stringify({ code, totalDebit, totalCredit, lines: input.lines.length }),
          createdAt: new Date(),
        },
      })
    }

    return createdEntry
  })

  return { id: entry.id, code: entry.code }
}

// === Reversal — creates a mirror entry that reverses the original ===
export async function reverseJournalEntry(entryId: string, userId?: string, reason?: string): Promise<{ id: string; code: string }> {
  const original = await db.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true } })
  if (!original) throw new Error('ENTRY_NOT_FOUND')
  if (original.state !== 'posted') throw new Error('ONLY_POSTED_CAN_REVERSE')

  // Mirror by accountId — no code round-trip, so reversal works even for
  // accounts whose code changed since the original posting.
  const reversalLines: JournalLineInput[] = original.lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    description: `عكس: ${l.description || ''}`,
    partnerId: l.partnerId || undefined,
    costCenterId: l.costCenterId || undefined,
    analyticAccountId: l.analyticAccountId || undefined,
    taxCodeId: l.taxCodeId || undefined,
  }))

  const reversal = await postJournalEntry({
    companyId: original.companyId,
    branchId: original.branchId ?? undefined,
    postingDate: new Date(),
    description: `عكس قيد ${original.code}${reason ? ` - ${reason}` : ''}`,
    refType: 'reversal',
    refId: original.id,
    currencyId: original.currencyId ?? undefined,
    lines: reversalLines,
    userId,
  })

  await db.journalEntry.update({ where: { id: entryId }, data: { state: 'reversed', reversedById: reversal.id } })

  return reversal
}

// ===========================================================================
// Posting Templates — pure, role-based, unit-testable.
// They never name an account code; `postJournalEntry` resolves the roles.
// ===========================================================================

/**
 * Sales Invoice: Dr AR / Cr Sales + Cr Output VAT (+ Dr Sales Discount).
 * FIX: a header-level discount previously produced an unbalanced entry because
 * `total` was net of the discount while the credit side used gross amounts.
 * The discount is now posted explicitly as a contra-revenue debit.
 */
export function salesInvoicePosting(args: {
  total: number
  subtotal: number
  taxTotal: number
  partnerId: string
  discount?: number
}): JournalLineInput[] {
  const discount = round2(args.discount ?? 0)
  const lines: JournalLineInput[] = [
    { role: 'CUSTOMER_RECEIVABLE', debit: round2(args.total), credit: 0, description: 'الذمم المدينة', partnerId: args.partnerId },
  ]
  if (discount > 0) {
    lines.push({ role: 'SALES_DISCOUNT', debit: discount, credit: 0, description: 'خصم مسموح على الفاتورة' })
  }
  lines.push({ role: 'SALES', debit: 0, credit: round2(args.subtotal), description: 'إيرادات المبيعات' })
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_PAYABLE', debit: 0, credit: round2(args.taxTotal), description: 'ضريبة القيمة المضافة مستحقة' })
  }
  return lines
}

/** Sales Cash: Dr Cash / Cr Sales + Cr Output VAT (+ Dr Sales Discount). */
export function salesCashPosting(args: {
  total: number
  subtotal: number
  taxTotal: number
  discount?: number
}): JournalLineInput[] {
  const discount = round2(args.discount ?? 0)
  const lines: JournalLineInput[] = [{ role: 'CASH', debit: round2(args.total), credit: 0, description: 'النقدية' }]
  if (discount > 0) {
    lines.push({ role: 'SALES_DISCOUNT', debit: discount, credit: 0, description: 'خصم مسموح على الفاتورة' })
  }
  lines.push({ role: 'SALES', debit: 0, credit: round2(args.subtotal), description: 'إيرادات المبيعات' })
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_PAYABLE', debit: 0, credit: round2(args.taxTotal), description: 'ضريبة القيمة المضافة مستحقة' })
  }
  return lines
}

/** Sales Return / Credit Note: Dr Sales Returns (contra revenue) + Dr VAT / Cr AR. */
export function salesReturnPosting(args: {
  total: number
  subtotal: number
  taxTotal: number
  partnerId: string
}): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    { role: 'SALES_RETURN', debit: round2(args.subtotal), credit: 0, description: 'مردودات المبيعات' },
  ]
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_PAYABLE', debit: round2(args.taxTotal), credit: 0, description: 'تخفيض ضريبة المخرجات' })
  }
  lines.push({ role: 'CUSTOMER_RECEIVABLE', debit: 0, credit: round2(args.total), description: 'تسوية ذمم مدينة', partnerId: args.partnerId })
  return lines
}

/** Purchase Invoice: Dr Purchases + Dr Input VAT / Cr AP. */
export function purchaseInvoicePosting(args: {
  total: number
  subtotal: number
  taxTotal: number
  partnerId: string
}): JournalLineInput[] {
  const lines: JournalLineInput[] = [{ role: 'PURCHASE', debit: round2(args.subtotal), credit: 0, description: 'المشتريات' }]
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_RECEIVABLE', debit: round2(args.taxTotal), credit: 0, description: 'ضريبة القيمة المضافة القابلة للخصم' })
  }
  lines.push({ role: 'SUPPLIER_PAYABLE', debit: 0, credit: round2(args.total), description: 'الذمم الدائنة', partnerId: args.partnerId })
  return lines
}

/** Purchase Return / Debit Note: Dr AP / Cr Purchase Returns + Cr Input VAT. */
export function purchaseReturnPosting(args: {
  total: number
  subtotal: number
  taxTotal: number
  partnerId: string
}): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    { role: 'SUPPLIER_PAYABLE', debit: round2(args.total), credit: 0, description: 'تسوية ذمم دائنة — إشعار مدين / مرتجع مشتريات', partnerId: args.partnerId },
  ]
  if (round2(args.subtotal) > 0) {
    lines.push({ role: 'PURCHASE_RETURN', debit: 0, credit: round2(args.subtotal), description: 'مردودات ومسموحات المشتريات' })
  }
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_RECEIVABLE', debit: 0, credit: round2(args.taxTotal), description: 'تخفيض ضريبة القيمة المضافة المدخلات' })
  }
  return lines
}

/** Purchase Cash: Dr Purchases + Dr Input VAT / Cr Cash. */
export function purchaseCashPosting(args: { total: number; subtotal: number; taxTotal: number }): JournalLineInput[] {
  const lines: JournalLineInput[] = [{ role: 'PURCHASE', debit: round2(args.subtotal), credit: 0, description: 'المشتريات' }]
  if (round2(args.taxTotal) > 0) {
    lines.push({ role: 'TAX_RECEIVABLE', debit: round2(args.taxTotal), credit: 0, description: 'ضريبة القيمة المضافة القابلة للخصم' })
  }
  lines.push({ role: 'CASH', debit: 0, credit: round2(args.total), description: 'النقدية' })
  return lines
}

/** Receipt (سند قبض): Dr Cash / Cr AR. */
export function receiptPosting(args: { amount: number; partnerId: string }): JournalLineInput[] {
  return [
    { role: 'CASH', debit: round2(args.amount), credit: 0, description: 'نقدية مستلمة' },
    { role: 'CUSTOMER_RECEIVABLE', debit: 0, credit: round2(args.amount), description: 'تسوية ذمم مدينة', partnerId: args.partnerId },
  ]
}

/** Payment (سند صرف): Dr AP / Cr Cash. */
export function paymentPosting(args: { amount: number; partnerId: string }): JournalLineInput[] {
  return [
    { role: 'SUPPLIER_PAYABLE', debit: round2(args.amount), credit: 0, description: 'تسوية ذمم دائنة', partnerId: args.partnerId },
    { role: 'CASH', debit: 0, credit: round2(args.amount), description: 'نقدية مدفوعة' },
  ]
}

/** Goods Receipt: Dr Inventory / Cr GRNI. */
export function goodsReceiptPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { role: 'INVENTORY', debit: round2(args.amount), credit: 0, description: 'المخزون' },
    { role: 'GRNI', debit: 0, credit: round2(args.amount), description: 'بضاعة مستلمة غير مفوترة' },
  ]
}

/** Delivery/COGS: Dr COGS / Cr Inventory. */
export function cogsPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { role: 'COGS', debit: round2(args.amount), credit: 0, description: 'تكلفة البضاعة المباعة' },
    { role: 'INVENTORY', debit: 0, credit: round2(args.amount), description: 'المخزون' },
  ]
}

/** Production Component Consumption: Dr WIP / Cr Raw Materials. */
export function productionConsumptionPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { role: 'WIP', debit: round2(args.amount), credit: 0, description: 'تحت التشغيل' },
    { role: 'RAW_MATERIALS', debit: 0, credit: round2(args.amount), description: 'مواد خام مستهلكة' },
  ]
}

/** Production FG Receipt: Dr Finished Goods / Cr WIP. */
export function productionFGReceiptPosting(args: { outputCost: number }): JournalLineInput[] {
  return [
    { role: 'FINISHED_GOODS', debit: round2(args.outputCost), credit: 0, description: 'بضاعة جاهزة منتجة' },
    { role: 'WIP', debit: 0, credit: round2(args.outputCost), description: 'تحت التشغيل' },
  ]
}

/**
 * Payroll: Dr Salary Expense / Cr Salaries Payable + Cr Deductions Payable.
 * FIX: deductions were previously credited to an OPERATING EXPENSE account,
 * which understated liabilities and distorted the income statement. Amounts
 * withheld on behalf of third parties are a LIABILITY, not a negative expense.
 */
export function payrollPosting(args: { gross: number; deductions: number; net: number }): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    { role: 'PAYROLL', debit: round2(args.gross), credit: 0, description: 'مصروف الرواتب' },
    { role: 'SALARIES_PAYABLE', debit: 0, credit: round2(args.net), description: 'رواتب مستحقة' },
  ]
  if (round2(args.deductions) > 0) {
    lines.push({ role: 'PAYROLL_DEDUCTIONS_PAYABLE', debit: 0, credit: round2(args.deductions), description: 'استقطاعات مستحقة للجهات' })
  }
  return lines
}

/** Expense: Dr Expense account / Cr Cash. */
export function expensePosting(args: { amount: number; expenseAccount?: string }): JournalLineInput[] {
  const debitLine: JournalLineInput = args.expenseAccount
    ? { accountCode: args.expenseAccount, debit: round2(args.amount), credit: 0, description: 'مصروف' }
    : { role: 'INVENTORY_LOSS', debit: round2(args.amount), credit: 0, description: 'مصروف' }
  return [debitLine, { role: 'CASH', debit: 0, credit: round2(args.amount), description: 'نقدية مدفوعة' }]
}

/** Revenue: Dr Cash / Cr Other Revenue. */
export function revenuePosting(args: { amount: number; revenueAccount?: string }): JournalLineInput[] {
  const creditLine: JournalLineInput = args.revenueAccount
    ? { accountCode: args.revenueAccount, debit: 0, credit: round2(args.amount), description: 'إيراد آخر' }
    : { role: 'OTHER_REVENUE', debit: 0, credit: round2(args.amount), description: 'إيراد آخر' }
  return [{ role: 'CASH', debit: round2(args.amount), credit: 0, description: 'نقدية مستلمة' }, creditLine]
}

/** Depreciation: Dr Depreciation Expense / Cr Accumulated Depreciation. */
export function depreciationPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { role: 'DEPRECIATION', debit: round2(args.amount), credit: 0, description: 'مصروف الإهلاك' },
    { role: 'ACCUMULATED_DEPRECIATION', debit: 0, credit: round2(args.amount), description: 'مجمع الإهلاك' },
  ]
}

/** Inventory Adjustment: surplus (Dr Inventory / Cr Gain) or shortage (Dr Loss / Cr Inventory). */
export function inventoryAdjustmentPosting(args: { varianceAmount: number }): JournalLineInput[] {
  const absAmount = round2(Math.abs(args.varianceAmount))
  if (args.varianceAmount > 0) {
    return [
      { role: 'INVENTORY', debit: absAmount, credit: 0, description: 'فائض تسوية مخزنية' },
      { role: 'INVENTORY_GAIN', debit: 0, credit: absAmount, description: 'أرباح تسوية المخزون' },
    ]
  }
  return [
    { role: 'INVENTORY_LOSS', debit: absAmount, credit: 0, description: 'خسارة تسوية مخزنية / عجز' },
    { role: 'INVENTORY', debit: 0, credit: absAmount, description: 'تسوية عجز المخزون' },
  ]
}
