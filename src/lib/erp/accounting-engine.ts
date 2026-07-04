// Automated double-entry accounting engine
// Generates balanced journal entries for sales, purchases, payments, and production
// Reference system account codes (must match seed data)

export const SYSTEM_ACCOUNTS = {
  CASH: '1000',
  BANK: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1300',
  RAW_MATERIALS: '1310',
  FINISHED_GOODS: '1320',
  INPUT_VAT: '1400',
  ACCOUNTS_PAYABLE: '2000',
  OUTPUT_VAT: '2100',
  RETAINED_EARNINGS: '3000',
  SALES_REVENUE: '4000',
  OTHER_REVENUE: '4100',
  COGS: '5000',
  PURCHASES: '5100',
  PRODUCTION_COST: '5200',
  OPERATING_EXPENSES: '6000',
} as const

export interface JournalLineInput {
  accountCode: string
  debit: number
  credit: number
  description?: string
}

export interface JournalEntryInput {
  date?: Date
  description: string
  refType?: string
  refId?: string
  lines: JournalLineInput[]
}

export function validateBalanced(lines: JournalLineInput[]): boolean {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

// === Sales: Dr Cash/AR, Cr Sales Revenue, Cr Output VAT ===
export function createSalesJournalEntry(args: {
  total: number
  taxTotal: number
  subtotal: number
  isCash: boolean
  refId?: string
  description?: string
}): JournalEntryInput {
  const { total, taxTotal, subtotal, isCash, refId, description } = args
  const debitAccount = isCash ? SYSTEM_ACCOUNTS.CASH : SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE
  return {
    description: description ?? 'عملية بيع',
    refType: 'sales_order',
    refId,
    lines: [
      { accountCode: debitAccount, debit: total, credit: 0, description: 'إجمالي المبيعات' },
      { accountCode: SYSTEM_ACCOUNTS.SALES_REVENUE, debit: 0, credit: subtotal, description: 'إيرادات المبيعات' },
      { accountCode: SYSTEM_ACCOUNTS.OUTPUT_VAT, debit: 0, credit: taxTotal, description: 'ضريبة القيمة المضافة' },
    ],
  }
}

// === Purchases: Dr Purchases, Dr Input VAT, Cr Cash/AP ===
export function createPurchaseJournalEntry(args: {
  total: number
  taxTotal: number
  subtotal: number
  isCash: boolean
  refId?: string
  description?: string
}): JournalEntryInput {
  const { total, taxTotal, subtotal, isCash, refId, description } = args
  const creditAccount = isCash ? SYSTEM_ACCOUNTS.CASH : SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE
  return {
    description: description ?? 'عملية شراء',
    refType: 'purchase_order',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.PURCHASES, debit: subtotal, credit: 0, description: 'المشتريات' },
      { accountCode: SYSTEM_ACCOUNTS.INPUT_VAT, debit: taxTotal, credit: 0, description: 'ضريبة القيمة المضافة القابلة للخصم' },
      { accountCode: creditAccount, debit: 0, credit: total, description: 'إجمالي المشتريات' },
    ],
  }
}

// === Payment receipt (from client): Dr Cash, Cr AR ===
export function createReceiptJournalEntry(args: { amount: number; refId?: string; description?: string }): JournalEntryInput {
  const { amount, refId, description } = args
  return {
    description: description ?? 'سند قبض',
    refType: 'payment',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.CASH, debit: amount, credit: 0, description: 'نقدية مستلمة' },
      { accountCode: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: 0, credit: amount, description: 'تسوية ذمم مدينة' },
    ],
  }
}

// === Payment made (to supplier): Dr AP, Cr Cash ===
export function createPaymentJournalEntry(args: { amount: number; refId?: string; description?: string }): JournalEntryInput {
  const { amount, refId, description } = args
  return {
    description: description ?? 'سند صرف',
    refType: 'payment',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, debit: amount, credit: 0, description: 'تسوية ذمم دائنة' },
      { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: amount, description: 'نقدية مدفوعة' },
    ],
  }
}

// === Production: Dr Finished Goods, Cr Raw Materials ===
export function createProductionJournalEntry(args: { outputCost: number; inputCost: number; refId?: string; description?: string }): JournalEntryInput {
  const { outputCost, inputCost, refId, description } = args
  return {
    description: description ?? 'قيد إنتاج',
    refType: 'production',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.FINISHED_GOODS, debit: outputCost, credit: 0, description: 'بضاعة جاهزة منتجة' },
      { accountCode: SYSTEM_ACCOUNTS.RAW_MATERIALS, debit: 0, credit: inputCost, description: 'مواد خام مستهلكة' },
      ...(outputCost - inputCost !== 0
        ? [{ accountCode: SYSTEM_ACCOUNTS.PRODUCTION_COST, debit: Math.max(0, inputCost - outputCost), credit: Math.max(0, outputCost - inputCost), description: 'فرق تكلفة الإنتاج' }]
        : []),
    ],
  }
}

// === Expense: Dr Operating Expenses, Cr Cash ===
export function createExpenseJournalEntry(args: { amount: number; refId?: string; description?: string }): JournalEntryInput {
  const { amount, refId, description } = args
  return {
    description: description ?? 'مصروف',
    refType: 'expense',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: amount, credit: 0, description: 'مصروف تشغيلي' },
      { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: amount, description: 'نقدية مدفوعة' },
    ],
  }
}

// === Revenue: Dr Cash, Cr Other Revenue ===
export function createRevenueJournalEntry(args: { amount: number; refId?: string; description?: string }): JournalEntryInput {
  const { amount, refId, description } = args
  return {
    description: description ?? 'إيراد',
    refType: 'revenue',
    refId,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.CASH, debit: amount, credit: 0, description: 'نقدية مستلمة' },
      { accountCode: SYSTEM_ACCOUNTS.OTHER_REVENUE, debit: 0, credit: amount, description: 'إيراد آخر' },
    ],
  }
}
