// Chart of Accounts – shared type definitions

export type AccountClass =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'operating_expense'
  | 'other_income'
  | 'other_expense'

export type NormalBalance = 'debit' | 'credit'
export type TaxBehavior = 'none' | 'taxable' | 'exempt' | 'zero_rated'
export type FsSection = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'equity_statement'

export interface AccountNode {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  shortName?: string
  accountClass: AccountClass
  type?: string
  subtype?: string
  parentId?: string
  isPosting: boolean
  isSystem: boolean
  normalBalance?: NormalBalance
  currencyId?: string
  allowReconciliation?: boolean
  allowManualEntry?: boolean
  taxBehavior?: TaxBehavior
  taxCodeId?: string
  fsSection?: FsSection
  reportCategory?: string
  reportSubcategory?: string
  reportTags?: string[]
  requireCostCenter?: boolean
  requireBranch?: boolean
  requireProject?: boolean
  level?: number
  path?: string
  active: boolean
  roles?: string[]
  ownBalance?: number
  balance?: number
  aggregateBalance?: number
  aggregateDebit?: number
  aggregateCredit?: number
  descendantCount?: number
  depth?: number
  children?: AccountNode[]
}

export interface AccountDetail extends AccountNode {
  breadcrumb?: { id: string; code: string; nameAr: string; level: number }[]
  parent?: { id: string; code: string; nameAr: string; accountClass: AccountClass }
  currency?: { id: string; code: string; nameAr: string; symbol: string }
  taxCode?: { id: string; code: string; nameAr: string; rate: number }
  childCount?: number
  lineCount?: number
  sumDebit?: number
  sumCredit?: number
  computedBalance?: number
  lastMovementDate?: string
  lastMovementEntry?: string
  canDelete?: boolean
  canConvertToGroup?: boolean
  canConvertToPosting?: boolean
}

export interface FlatAccount extends AccountNode {
  childCount?: number
  lineCount?: number
  sumDebit?: number
  sumCredit?: number
  computedBalance?: number
  parent?: { id: string; code: string; nameAr: string } | null
}

export interface AccountStats {
  totals: {
    accounts: number
    postingAccounts: number
    groupAccounts: number
    activeAccounts: number
    inactiveAccounts: number
    systemAccounts: number
  }
  byClass: Record<AccountClass, { count: number; balance: number }>
  financial: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    accountingEquationDelta: number
  }
  determination: {
    mappedRoles: number
    totalRoles: number
    missingRequiredRoles: string[]
  }
}

export interface AccountMeta {
  classes: {
    code: AccountClass
    nameAr: string
    nameEn: string
    type: string
    normalBalance: NormalBalance
    fsSection: FsSection
    codePrefix: string
    subtypes: string[]
  }[]
  roles: {
    code: string
    nameAr: string
    nameEn: string
    group: string
    required: boolean
    allowedClasses: AccountClass[]
    descriptionAr: string
  }[]
  normalBalances: string[]
  taxBehaviors: string[]
  fsSections: string[]
  currencies: { id: string; code: string; nameAr: string; symbol: string }[]
  taxCodes: { id: string; code: string; nameAr: string; rate: number }[]
}

export interface RoleMapping {
  role: string
  nameAr: string
  nameEn: string
  group: string
  required: boolean
  descriptionAr: string
  allowedClasses: AccountClass[]
  mapping: {
    id: string
    account: { id: string; code: string; nameAr: string; accountClass: AccountClass }
    active: boolean
  } | null
}

export interface LedgerLine {
  id: string
  debit?: number
  credit?: number
  description?: string
  account?: { code: string; nameAr: string }
  partner?: string
  costCenter?: string
  entry?: {
    id: string
    code: string
    postingDate: string
    description: string
    refType?: string
    state: string
  }
  runningBalance?: number
}

export interface LedgerData {
  account: AccountDetail
  opening: { debit: number; credit: number; balance: number }
  period: { debit: number; credit: number; movement: number }
  closing: { balance: number }
  lines: LedgerLine[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface AuditRecord {
  id: string
  action: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  reason?: string
  createdAt: string
  user?: { username: string; nameAr: string }
}

export interface TransactionRecord {
  id: string
  code: string
  postingDate: string
  description: string
  refType?: string
  state: string
  totalDebit?: number
  totalCredit?: number
  journal?: string
}

export interface CreateAccountPayload {
  code?: string
  nameAr: string
  nameEn?: string
  shortName?: string
  accountClass: AccountClass
  subtype?: string
  parentId?: string
  isPosting: boolean
  normalBalance?: NormalBalance
  currencyId?: string
  allowReconciliation?: boolean
  allowManualEntry?: boolean
  taxBehavior?: TaxBehavior
  taxCodeId?: string
  fsSection?: FsSection
  reportCategory?: string
  reportSubcategory?: string
  reportTags?: string[]
  requireCostCenter?: boolean
  requireBranch?: boolean
  requireProject?: boolean
  active?: boolean
  role?: string
  reason?: string
}

export type ViewMode = 'tree' | 'flat'

export interface TreeFilters {
  search: string
  accountClass: AccountClass | 'all'
  active: 'all' | 'active' | 'inactive'
  kind: 'all' | 'group' | 'posting'
  systemOnly: boolean
}
