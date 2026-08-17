// Enterprise ERP — Account Classes (Chart of Accounts taxonomy)
// The class is the structural/reporting classification. The legacy `type` field
// (asset|liability|equity|income|expense) stays in the schema as the ledger
// primitive so every existing report and posting keeps working; it is DERIVED
// from the class and must never be set independently.

export type AccountClass =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'operating_expense'
  | 'other_income'
  | 'other_expense'

export type LedgerType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type NormalBalance = 'debit' | 'credit'
export type FsSection = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'none'

export interface AccountClassDef {
  code: AccountClass
  nameAr: string
  nameEn: string
  /** Derived ledger primitive — backward compatible with existing postings. */
  type: LedgerType
  /** Default normal balance; individual contra accounts may override. */
  normalBalance: NormalBalance
  fsSection: FsSection
  /** Default first digit of the account code for this class. */
  codePrefix: string
  /** Valid subtypes for this class. */
  subtypes: readonly string[]
}

export const ACCOUNT_CLASSES = {
  asset: {
    code: 'asset',
    nameAr: 'الأصول',
    nameEn: 'Assets',
    type: 'asset',
    normalBalance: 'debit',
    fsSection: 'balance_sheet',
    codePrefix: '1',
    subtypes: ['current_asset', 'cash_and_equivalents', 'receivable', 'inventory', 'prepaid', 'fixed_asset', 'intangible_asset', 'contra_asset', 'other_asset'],
  },
  liability: {
    code: 'liability',
    nameAr: 'الالتزامات',
    nameEn: 'Liabilities',
    type: 'liability',
    normalBalance: 'credit',
    fsSection: 'balance_sheet',
    codePrefix: '2',
    subtypes: ['current_liability', 'payable', 'tax_liability', 'accrued_liability', 'long_term_liability', 'provision', 'other_liability'],
  },
  equity: {
    code: 'equity',
    nameAr: 'حقوق الملكية',
    nameEn: 'Equity',
    type: 'equity',
    normalBalance: 'credit',
    fsSection: 'balance_sheet',
    codePrefix: '3',
    subtypes: ['capital', 'retained_earnings', 'current_year_earnings', 'reserves', 'drawings', 'other_equity'],
  },
  revenue: {
    code: 'revenue',
    nameAr: 'الإيرادات',
    nameEn: 'Revenue',
    type: 'income',
    normalBalance: 'credit',
    fsSection: 'income_statement',
    codePrefix: '4',
    subtypes: ['operating_revenue', 'service_revenue', 'contra_revenue', 'other_revenue'],
  },
  cogs: {
    code: 'cogs',
    nameAr: 'تكلفة المبيعات',
    nameEn: 'Cost of Sales',
    type: 'expense',
    normalBalance: 'debit',
    fsSection: 'income_statement',
    codePrefix: '5',
    subtypes: ['cogs', 'purchases', 'contra_purchases', 'direct_labor', 'manufacturing_overhead', 'freight_in'],
  },
  operating_expense: {
    code: 'operating_expense',
    nameAr: 'المصروفات التشغيلية',
    nameEn: 'Operating Expenses',
    type: 'expense',
    normalBalance: 'debit',
    fsSection: 'income_statement',
    codePrefix: '6',
    subtypes: ['payroll_expense', 'rent_expense', 'utilities_expense', 'selling_expense', 'administrative_expense', 'depreciation_expense', 'operating_expense'],
  },
  other_income: {
    code: 'other_income',
    nameAr: 'إيرادات أخرى',
    nameEn: 'Other Income',
    type: 'income',
    normalBalance: 'credit',
    fsSection: 'income_statement',
    codePrefix: '7',
    subtypes: ['other_revenue', 'fx_gain', 'gain_on_disposal', 'investment_income'],
  },
  other_expense: {
    code: 'other_expense',
    nameAr: 'مصروفات أخرى',
    nameEn: 'Other Expenses',
    type: 'expense',
    normalBalance: 'debit',
    fsSection: 'income_statement',
    codePrefix: '8',
    subtypes: ['other_expense', 'fx_loss', 'loss_on_disposal', 'finance_cost', 'zakat_tax_expense'],
  },
} as const satisfies Record<AccountClass, AccountClassDef>

export const ACCOUNT_CLASS_CODES = Object.keys(ACCOUNT_CLASSES) as AccountClass[]

export function isAccountClass(v: string): v is AccountClass {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_CLASSES, v)
}

export function classDef(c: string): AccountClassDef | undefined {
  return isAccountClass(c) ? (ACCOUNT_CLASSES[c] as AccountClassDef) : undefined
}

/** Derive the legacy ledger type from a class. Never let callers pass `type` directly. */
export function ledgerTypeForClass(c: AccountClass): LedgerType {
  return ACCOUNT_CLASSES[c].type
}

export function defaultNormalBalance(c: AccountClass): NormalBalance {
  return ACCOUNT_CLASSES[c].normalBalance
}

export function defaultFsSection(c: AccountClass): FsSection {
  return ACCOUNT_CLASSES[c].fsSection
}

export function isValidSubtype(c: AccountClass, subtype: string): boolean {
  return (ACCOUNT_CLASSES[c].subtypes as readonly string[]).includes(subtype)
}

/**
 * Map a legacy `type` (+ optional subtype) to the new class. Used by the data
 * migration and by any payload that still speaks the old vocabulary.
 */
export function classFromLegacyType(type: string, subtype?: string | null): AccountClass {
  const st = (subtype ?? '').toLowerCase()
  switch (type) {
    case 'asset':
      return 'asset'
    case 'liability':
      return 'liability'
    case 'equity':
      return 'equity'
    case 'income':
      return st.includes('other') || st === 'fx_gain' ? 'other_income' : 'revenue'
    case 'expense':
      if (st === 'cogs' || st === 'purchases' || st.includes('production')) return 'cogs'
      if (st === 'fx_loss' || st === 'finance_cost' || st === 'other_expense') return 'other_expense'
      return 'operating_expense'
    default:
      return 'asset'
  }
}

/**
 * Signed balance for presentation: a debit-normal account shows debit-credit,
 * a credit-normal account shows credit-debit. This makes contra accounts
 * (accumulated depreciation, sales returns) present as positive magnitudes.
 */
export function signedBalance(normalBalance: string, sumDebit: number, sumCredit: number): number {
  const d = Number(sumDebit) || 0
  const c = Number(sumCredit) || 0
  return normalBalance === 'credit' ? c - d : d - c
}
