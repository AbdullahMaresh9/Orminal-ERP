// Enterprise ERP — Central Posting Engine
// Source: ADR-002 Ledger-Centric Posting, ADR-018 Draft→Post→Reverse
// Source: Book 2 §2.2.4 PostingPreparationService, §2.7 Posting Transaction Rules
// Source: Arabic Accounting Spec §12 — Journal Entry Catalog (16 operations)
//
// All accounting postings MUST go through this engine. No module posts directly.
// Posted journal entries are IMMUTABLE. Corrections use reversal only.

import { db } from '@/lib/db'
import { nextNumber } from './number-sequence'

// System account codes (must match seed)
export const SYSTEM_ACCOUNTS = {
  CASH: '1000',
  CASH_SAFE: '1010',
  CASH_BANK: '1020',
  AR: '1100',          // Accounts Receivable
  INVENTORY: '1200',
  RAW_MATERIALS: '1210',
  FINISHED_GOODS: '1220',
  WIP: '1230',
  INPUT_VAT: '1400',
  FIXED_ASSETS: '1500',
  ACC_DEPRECIATION: '1590',
  AP: '2000',          // Accounts Payable
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
  accountCode: string
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
  refType?: string // sales_order|sales_invoice|purchase_order|purchase_invoice|payment|production|manual|opening|closing
  refId?: string
  currencyId?: string
  lines: JournalLineInput[]
  userId?: string
}

// Validate that debit total === credit total (BR-FIN-001)
export function validateBalanced(lines: JournalLineInput[]): boolean {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

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
}

// === Central post function — creates a posted journal entry atomically ===
export async function postJournalEntry(input: PostEntryInput): Promise<{ id: string; code: string }> {
  // BR-FIN-001: Validate balanced
  if (!validateBalanced(input.lines)) {
    throw new Error('UNBALANCED_JOURNAL: debit != credit')
  }
  if (input.lines.length < 2) {
    throw new Error('JOURNAL_MIN_LINES: at least 2 lines required')
  }

  // Resolve account codes → IDs
  const accountMap = await resolveAccounts(input.lines)
  for (const line of input.lines) {
    if (!accountMap.has(line.accountCode)) {
      throw new Error(`ACCOUNT_NOT_FOUND: ${line.accountCode}`)
    }
  }

  // Find journal by type (with auto-creation fallback)
  let journal: any = null
  if (input.journalType) {
    const journalMap: Record<string, string> = {
      sale: 'SJ', purchase: 'PJ', cash: 'CJ', bank: 'BJ', general: 'GJ', opening: 'OJ', closing: 'CLJ',
    }
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
  }

  // Find fiscal period for posting date
  const postingDate = input.postingDate ?? new Date()
  const fiscalPeriod = await db.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  })

  // BR-FIN-002: Check period open
  if (fiscalPeriod && fiscalPeriod.state === 'closed') {
    throw new Error('PERIOD_CLOSED: posting date is in a closed period')
  }

  // Generate document number
  const code = await nextNumber('journal_entry', input.companyId, input.branchId, postingDate.getFullYear())

  const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0)

  // Create the posted journal entry with lines
  const entry = await db.journalEntry.create({
    data: {
      companyId: input.companyId,
      branchId: input.branchId,
      code,
      journalId: journal?.id,
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
        create: input.lines.map((l) => ({
          accountId: accountMap.get(l.accountCode)!,
          partnerId: l.partnerId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
          costCenterId: l.costCenterId,
          analyticAccountId: l.analyticAccountId,
          taxCodeId: l.taxCodeId,
        })),
      },
    },
  })

  // Update account balances
  for (const line of input.lines) {
    const accountId = accountMap.get(line.accountCode)!
    const account = await db.account.findUnique({ where: { id: accountId } })
    if (account) {
      // Assets & Expenses: debit increases, credit decreases
      // Liabilities, Equity, Income: credit increases, debit decreases
      const isDebitNormal = account.type === 'asset' || account.type === 'expense'
      const delta = isDebitNormal ? (line.debit - line.credit) : (line.credit - line.debit)
      await db.account.update({
        where: { id: accountId },
        data: { balance: { increment: delta } },
      })
    }
  }

  // Audit log
  if (input.userId) {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        moduleCode: 'FIN',
        documentType: 'journal_entry',
        documentId: entry.id,
        action: 'post',
        newValue: JSON.stringify({ code, totalDebit, totalCredit, lines: input.lines.length }),
        createdAt: new Date(),
      },
    })
  }

  return { id: entry.id, code: entry.code }
}

// === Reversal — creates a mirror entry that reverses the original ===
export async function reverseJournalEntry(entryId: string, userId?: string, reason?: string): Promise<{ id: string; code: string }> {
  const original = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  })
  if (!original) throw new Error('ENTRY_NOT_FOUND')
  if (original.state !== 'posted') throw new Error('ONLY_POSTED_CAN_REVERSE')

  // Create reversal with swapped debit/credit
  const reversalLines: JournalLineInput[] = original.lines.map((l) => ({
    accountCode: '', // will be resolved from account
    debit: l.credit,
    credit: l.debit,
    description: `عكس: ${l.description || ''}`,
    partnerId: l.partnerId || undefined,
    costCenterId: l.costCenterId || undefined,
  }))

  // Get account codes
  const accountIds = original.lines.map((l) => l.accountId)
  const accounts = await db.account.findMany({ where: { id: { in: accountIds } } })
  const accountMap = new Map(accounts.map((a) => [a.id, a.code]))
  reversalLines.forEach((l, i) => {
    l.accountCode = accountMap.get(original.lines[i].accountId) || ''
  })

  const reversal = await postJournalEntry({
    companyId: original.companyId,
    branchId: original.branchId ?? undefined,
    postingDate: new Date(),
    description: `عكس قيد ${original.code}${reason ? ` - ${reason}` : ''}`,
    refType: 'reversal',
    refId: original.id,
    lines: reversalLines,
    userId,
  })

  // Mark original as reversed
  await db.journalEntry.update({
    where: { id: entryId },
    data: { state: 'reversed' },
  })

  return reversal
}

// === Posting Templates (Arabic Accounting Spec §12) ===

// Sales Invoice: Dr AR / Cr Sales Revenue + Cr Output VAT
export function salesInvoicePosting(args: {
  total: number; subtotal: number; taxTotal: number; partnerId: string
}): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.AR, debit: args.total, credit: 0, description: 'الذمم المدينة', partnerId: args.partnerId },
    { accountCode: SYSTEM_ACCOUNTS.SALES_REVENUE, debit: 0, credit: args.subtotal, description: 'إيرادات المبيعات' },
    { accountCode: SYSTEM_ACCOUNTS.OUTPUT_VAT, debit: 0, credit: args.taxTotal, description: 'ضريبة القيمة المضافة مستحقة' },
  ]
}

// Sales Cash: Dr Cash / Cr Sales Revenue + Cr Output VAT
export function salesCashPosting(args: {
  total: number; subtotal: number; taxTotal: number
}): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: args.total, credit: 0, description: 'النقدية' },
    { accountCode: SYSTEM_ACCOUNTS.SALES_REVENUE, debit: 0, credit: args.subtotal, description: 'إيرادات المبيعات' },
    { accountCode: SYSTEM_ACCOUNTS.OUTPUT_VAT, debit: 0, credit: args.taxTotal, description: 'ضريبة القيمة المضافة مستحقة' },
  ]
}

// Purchase Invoice: Dr Purchases + Dr Input VAT / Cr AP
export function purchaseInvoicePosting(args: {
  total: number; subtotal: number; taxTotal: number; partnerId: string
}): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.PURCHASES, debit: args.subtotal, credit: 0, description: 'المشتريات' },
    { accountCode: SYSTEM_ACCOUNTS.INPUT_VAT, debit: args.taxTotal, credit: 0, description: 'ضريبة القيمة المضافة القابلة للخصم' },
    { accountCode: SYSTEM_ACCOUNTS.AP, debit: 0, credit: args.total, description: 'الذمم الدائنة', partnerId: args.partnerId },
  ]
}

// Purchase Return / Debit Note: Dr AP / Cr Purchases + Cr Input VAT
export function purchaseReturnPosting(args: {
  total: number; subtotal: number; taxTotal: number; partnerId: string
}): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    { accountCode: SYSTEM_ACCOUNTS.AP, debit: args.total, credit: 0, description: 'تسوية ذمم دائنة — إشعار مدين / مرتجع مشتريات', partnerId: args.partnerId },
  ]
  if (args.subtotal > 0) {
    lines.push({ accountCode: SYSTEM_ACCOUNTS.PURCHASES, debit: 0, credit: args.subtotal, description: 'مردودات ومسموحات المشتريات' })
  }
  if (args.taxTotal > 0) {
    lines.push({ accountCode: SYSTEM_ACCOUNTS.INPUT_VAT, debit: 0, credit: args.taxTotal, description: 'تخفيض ضريبة القيمة المضافة المدخلات' })
  }
  return lines
}

// Purchase Cash: Dr Purchases + Dr Input VAT / Cr Cash
export function purchaseCashPosting(args: {
  total: number; subtotal: number; taxTotal: number
}): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.PURCHASES, debit: args.subtotal, credit: 0, description: 'المشتريات' },
    { accountCode: SYSTEM_ACCOUNTS.INPUT_VAT, debit: args.taxTotal, credit: 0, description: 'ضريبة القيمة المضافة القابلة للخصم' },
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: args.total, description: 'النقدية' },
  ]
}

// Receipt (سند قبض): Dr Cash / Cr AR
export function receiptPosting(args: { amount: number; partnerId: string }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: args.amount, credit: 0, description: 'نقدية مستلمة' },
    { accountCode: SYSTEM_ACCOUNTS.AR, debit: 0, credit: args.amount, description: 'تسوية ذمم مدينة', partnerId: args.partnerId },
  ]
}

// Payment (سند صرف): Dr AP / Cr Cash
export function paymentPosting(args: { amount: number; partnerId: string }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.AP, debit: args.amount, credit: 0, description: 'تسوية ذمم دائنة', partnerId: args.partnerId },
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: args.amount, description: 'نقدية مدفوعة' },
  ]
}

// Goods Receipt: Dr Inventory / Cr GRNI
export function goodsReceiptPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: args.amount, credit: 0, description: 'المخزون' },
    { accountCode: SYSTEM_ACCOUNTS.GRNI, debit: 0, credit: args.amount, description: 'بضاعة مستلمة غير مفوتر' },
  ]
}

// Delivery/COGS: Dr COGS / Cr Inventory
export function cogsPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.COGS, debit: args.amount, credit: 0, description: 'تكلفة البضاعة المباعة' },
    { accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: 0, credit: args.amount, description: 'المخزون' },
  ]
}

// Production Component Consumption: Dr WIP / Cr Raw Materials
export function productionConsumptionPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.WIP, debit: args.amount, credit: 0, description: 'تحت التشغيل' },
    { accountCode: SYSTEM_ACCOUNTS.RAW_MATERIALS, debit: 0, credit: args.amount, description: 'مواد خام مستهلكة' },
  ]
}

// Production FG Receipt: Dr Finished Goods / Cr WIP
export function productionFGReceiptPosting(args: { outputCost: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.FINISHED_GOODS, debit: args.outputCost, credit: 0, description: 'بضاعة جاهزة منتجة' },
    { accountCode: SYSTEM_ACCOUNTS.WIP, debit: 0, credit: args.outputCost, description: 'تحت التشغيل' },
  ]
}

// Payroll: Dr Salary Expense / Cr Salaries Payable
export function payrollPosting(args: { gross: number; deductions: number; net: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.SALARIES_EXPENSE, debit: args.gross, credit: 0, description: 'مصروف الرواتب' },
    { accountCode: SYSTEM_ACCOUNTS.SALARIES_PAYABLE, debit: 0, credit: args.net, description: 'رواتب مستحقة' },
    { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: 0, credit: args.deductions, description: 'استقطاعات' },
  ]
}

// Expense: Dr Operating Expenses / Cr Cash
export function expensePosting(args: { amount: number; expenseAccount?: string }): JournalLineInput[] {
  return [
    { accountCode: args.expenseAccount || SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: args.amount, credit: 0, description: 'مصروف' },
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: args.amount, description: 'نقدية مدفوعة' },
  ]
}

// Revenue: Dr Cash / Cr Other Revenue
export function revenuePosting(args: { amount: number; revenueAccount?: string }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.CASH, debit: args.amount, credit: 0, description: 'نقدية مستلمة' },
    { accountCode: args.revenueAccount || SYSTEM_ACCOUNTS.OTHER_REVENUE, debit: 0, credit: args.amount, description: 'إيراد آخر' },
  ]
}

// Depreciation: Dr Depreciation Expense / Cr Accumulated Depreciation
export function depreciationPosting(args: { amount: number }): JournalLineInput[] {
  return [
    { accountCode: SYSTEM_ACCOUNTS.DEPRECIATION_EXPENSE, debit: args.amount, credit: 0, description: 'مصروف الإهلاك' },
    { accountCode: SYSTEM_ACCOUNTS.ACC_DEPRECIATION, debit: 0, credit: args.amount, description: 'مجمع الإهلاك' },
  ]
}

// Inventory Adjustment: Surplus (Dr Inventory / Cr Revenue) or Shortage (Dr Expense / Cr Inventory)
export function inventoryAdjustmentPosting(args: { varianceAmount: number }): JournalLineInput[] {
  const absAmount = Math.abs(args.varianceAmount)
  if (args.varianceAmount > 0) {
    return [
      { accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: absAmount, credit: 0, description: 'فائض تسوية مخزنية' },
      { accountCode: SYSTEM_ACCOUNTS.OTHER_REVENUE, debit: 0, credit: absAmount, description: 'أرباح تسوية المخزون' },
    ]
  } else {
    return [
      { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: absAmount, credit: 0, description: 'خسارة تسوية مخزنية / عجز' },
      { accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: 0, credit: absAmount, description: 'تسوية عجز المخزون' },
    ]
  }
}
