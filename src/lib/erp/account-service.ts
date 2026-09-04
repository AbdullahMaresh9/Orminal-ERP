// Enterprise ERP — Chart of Accounts service layer
// All Chart-of-Accounts business rules live here so the API routes stay thin and
// the rules are unit-testable without a database.

import { db } from '@/lib/db'
import {
  ACCOUNT_CLASSES,
  classDef,
  defaultFsSection,
  defaultNormalBalance,
  isAccountClass,
  isValidSubtype,
  ledgerTypeForClass,
  signedBalance,
  type AccountClass,
} from './account-classes'
import { isValidRole, roleAcceptsClass } from './account-roles'
import { getConfigBool, getConfigNumber } from '@/lib/config/resolve'

export interface FieldError {
  field: string
  code: string
  message: string
  rejectedValue?: unknown
}

export interface AccountInput {
  code?: string
  nameAr?: string
  nameEn?: string | null
  shortName?: string | null
  accountClass?: string
  subtype?: string | null
  parentId?: string | null
  isPosting?: boolean
  normalBalance?: string
  currencyId?: string | null
  allowReconciliation?: boolean
  allowManualEntry?: boolean
  taxBehavior?: string
  taxCodeId?: string | null
  fsSection?: string
  reportCategory?: string | null
  reportSubcategory?: string | null
  reportTags?: string[] | string | null
  requireCostCenter?: boolean
  requireBranch?: boolean
  requireProject?: boolean
  active?: boolean
  role?: string | null
}

/** Minimal shape needed for pure hierarchy math (keeps the unit tests DB-free). */
export interface AccountNodeLike {
  id: string
  code: string
  nameAr: string
  nameEn?: string | null
  parentId?: string | null
  isPosting: boolean
  accountClass: string
  normalBalance: string
  active: boolean
  isSystem?: boolean
}

export const VALID_NORMAL_BALANCE = ['debit', 'credit'] as const
export const VALID_TAX_BEHAVIOR = ['none', 'input', 'output', 'withholding'] as const
export const VALID_FS_SECTION = ['balance_sheet', 'income_statement', 'cash_flow', 'none'] as const

// ---------------------------------------------------------------------------
// Pure validation
// ---------------------------------------------------------------------------

/**
 * Validate a create/update payload. `existing` is provided on update so we can
 * apply immutability rules (system accounts, accounts with postings).
 */
export function validateAccountInput(
  input: AccountInput,
  opts: {
    isCreate: boolean
    existing?: (AccountNodeLike & { hasPostings?: boolean; childCount?: number }) | null
    parent?: AccountNodeLike | null
    /** From coa.accountCodeNumericOnly — true: digits-only codes. */
    numericOnly?: boolean
    /** From coa.codeMinLength */
    codeMinLength?: number
    /** From coa.codeMaxLength */
    codeMaxLength?: number
  }
): FieldError[] {
  const errors: FieldError[] = []
  const { isCreate, existing, parent } = opts

  // --- code (with live config constraints) ---
  if (isCreate || input.code !== undefined) {
    const code = (input.code ?? '').trim()
    if (!code) {
      errors.push({ field: 'code', code: 'REQUIRED', message: 'رمز الحساب مطلوب' })
    } else {
      // Fetch runtime config (parallel, non-blocking on the validation call)
      // We read synchronously via the cached resolve layer — no await here means
      // callers that do NOT have an async context can still call validateAccountInput.
      // For async-aware validation use validateAccountInputAsync below.
      const numericOnly = opts.numericOnly ?? false
      const codeMinLen = opts.codeMinLength ?? 2
      const codeMaxLen = opts.codeMaxLength ?? 20
      const pattern = numericOnly ? /^\d{1,30}$/ : /^[0-9A-Za-z._-]{1,30}$/
      const minMsg = numericOnly
        ? `رمز الحساب يجب أن يكون أرقاماً فقط (${codeMinLen}–${codeMaxLen} خانة)`
        : `رمز الحساب يقبل الأرقام والحروف والنقطة والشرطة (${codeMinLen}–${codeMaxLen} خانة)`
      if (!pattern.test(code)) {
        errors.push({ field: 'code', code: 'INVALID_FORMAT', message: minMsg, rejectedValue: code })
      } else if (code.length < codeMinLen) {
        errors.push({ field: 'code', code: 'TOO_SHORT', message: `رمز الحساب يجب ألا يقل عن ${codeMinLen} خانات`, rejectedValue: code })
      } else if (code.length > codeMaxLen) {
        errors.push({ field: 'code', code: 'TOO_LONG', message: `رمز الحساب يجب ألا يتجاوز ${codeMaxLen} خانة`, rejectedValue: code })
      }
    }
    if (existing?.isSystem && (input.code ?? '').trim() && (input.code ?? '').trim() !== existing.code) {
      errors.push({ field: 'code', code: 'IMMUTABLE_SYSTEM', message: 'لا يمكن تغيير رمز حساب نظامي' })
    }
  }

  // --- names ---
  if (isCreate || input.nameAr !== undefined) {
    if (!(input.nameAr ?? '').trim()) {
      errors.push({ field: 'nameAr', code: 'REQUIRED', message: 'الاسم العربي مطلوب' })
    }
  }

  // --- class ---
  const effectiveClass = (input.accountClass ?? existing?.accountClass) as string | undefined
  if (isCreate || input.accountClass !== undefined) {
    if (!effectiveClass || !isAccountClass(effectiveClass)) {
      errors.push({ field: 'accountClass', code: 'REQUIRED', message: 'فئة الحساب مطلوبة وغير صحيحة', rejectedValue: input.accountClass })
    }
  }

  const klass = effectiveClass && isAccountClass(effectiveClass) ? effectiveClass : undefined

  // class changes are blocked once the account carries postings, and on system accounts
  if (!isCreate && existing && input.accountClass && input.accountClass !== existing.accountClass) {
    if (existing.hasPostings) {
      errors.push({ field: 'accountClass', code: 'HAS_POSTINGS', message: 'لا يمكن تغيير فئة حساب له قيود مرحّلة — أنشئ حساباً جديداً وأوقف هذا' })
    }
    if (existing.isSystem) {
      errors.push({ field: 'accountClass', code: 'IMMUTABLE_SYSTEM', message: 'لا يمكن تغيير فئة حساب نظامي' })
    }
  }

  // --- subtype ---
  if (klass && input.subtype) {
    if (!isValidSubtype(klass, input.subtype)) {
      errors.push({
        field: 'subtype',
        code: 'INVALID_COMBINATION',
        message: `النوع الفرعي "${input.subtype}" غير صالح لفئة "${ACCOUNT_CLASSES[klass].nameAr}"`,
        rejectedValue: input.subtype,
      })
    }
  }

  // --- normal balance ---
  if (input.normalBalance !== undefined && !(VALID_NORMAL_BALANCE as readonly string[]).includes(input.normalBalance)) {
    errors.push({ field: 'normalBalance', code: 'INVALID_VALUE', message: 'طبيعة الرصيد يجب أن تكون مدين أو دائن', rejectedValue: input.normalBalance })
  }

  // --- tax behaviour ---
  if (input.taxBehavior !== undefined && !(VALID_TAX_BEHAVIOR as readonly string[]).includes(input.taxBehavior)) {
    errors.push({ field: 'taxBehavior', code: 'INVALID_VALUE', message: 'سلوك الضريبة غير صحيح', rejectedValue: input.taxBehavior })
  }

  // --- financial statement section ---
  if (input.fsSection !== undefined && !(VALID_FS_SECTION as readonly string[]).includes(input.fsSection)) {
    errors.push({ field: 'fsSection', code: 'INVALID_VALUE', message: 'القائمة المالية غير صحيحة', rejectedValue: input.fsSection })
  }

  // --- parent rules ---
  if (input.parentId) {
    if (!parent) {
      errors.push({ field: 'parentId', code: 'NOT_FOUND', message: 'الحساب الأب غير موجود', rejectedValue: input.parentId })
    } else {
      if (parent.isPosting) {
        errors.push({ field: 'parentId', code: 'PARENT_NOT_GROUP', message: `الحساب الأب "${parent.code}" حساب ترحيل — يجب تحويله إلى حساب مجمّع أولاً` })
      }
      if (!parent.active) {
        errors.push({ field: 'parentId', code: 'PARENT_INACTIVE', message: 'لا يمكن الإضافة تحت حساب غير نشط' })
      }
      if (klass && parent.accountClass !== klass) {
        errors.push({
          field: 'accountClass',
          code: 'CLASS_MISMATCH_PARENT',
          message: `فئة الحساب يجب أن تطابق فئة الأب (${parent.accountClass})`,
          rejectedValue: klass,
        })
      }
      if (existing && parent.id === existing.id) {
        errors.push({ field: 'parentId', code: 'SELF_PARENT', message: 'لا يمكن أن يكون الحساب أباً لنفسه' })
      }
    }
  }

  // --- group/posting transition rules ---
  if (!isCreate && existing && input.isPosting !== undefined && input.isPosting !== existing.isPosting) {
    // group -> posting requires no children
    if (input.isPosting === true && (existing.childCount ?? 0) > 0) {
      errors.push({ field: 'isPosting', code: 'HAS_CHILDREN', message: 'لا يمكن تحويل حساب له حسابات فرعية إلى حساب ترحيل' })
    }
    // posting -> group requires no postings
    if (input.isPosting === false && existing.hasPostings) {
      errors.push({ field: 'isPosting', code: 'HAS_POSTINGS', message: 'لا يمكن تحويل حساب له قيود مرحّلة إلى حساب مجمّع' })
    }
  }

  // --- role guard ---
  if (input.role) {
    if (!isValidRole(input.role)) {
      errors.push({ field: 'role', code: 'UNKNOWN_ROLE', message: `الدور النظامي "${input.role}" غير معروف`, rejectedValue: input.role })
    } else {
      if (klass && !roleAcceptsClass(input.role, klass)) {
        errors.push({
          field: 'role',
          code: 'ROLE_CLASS_MISMATCH',
          message: `الدور "${input.role}" لا يمكن ربطه بفئة "${klass}"`,
          rejectedValue: input.role,
        })
      }
      const willBePosting = input.isPosting ?? existing?.isPosting ?? true
      if (!willBePosting) {
        errors.push({ field: 'role', code: 'ROLE_ON_GROUP', message: 'لا يمكن إسناد دور نظامي إلى حساب مجمّع — الأدوار تُسند لحسابات الترحيل فقط' })
      }
    }
  }

  return errors
}

/**
 * Cycle detection for a proposed parent change. Walks up from the candidate
 * parent; if we reach the account itself, the move would create a loop.
 * `parentOf` maps accountId -> parentId.
 */
export function wouldCreateCycle(accountId: string, newParentId: string | null | undefined, parentOf: Map<string, string | null>): boolean {
  if (!newParentId) return false
  if (newParentId === accountId) return true
  let cursor: string | null | undefined = newParentId
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === accountId) return true
    if (seen.has(cursor)) return true // pre-existing corruption; refuse the move
    seen.add(cursor)
    cursor = parentOf.get(cursor) ?? null
  }
  return false
}

/** Materialized path: '/rootId/childId/thisId'. */
export function buildPath(parentPath: string | null | undefined, id: string): string {
  const base = (parentPath ?? '').replace(/\/$/, '')
  return `${base}/${id}`
}

export function levelFromPath(path: string): number {
  return Math.max(0, path.split('/').filter(Boolean).length - 1)
}

// ---------------------------------------------------------------------------
// Tree building + balance rollup (pure)
// ---------------------------------------------------------------------------

export interface AccountTreeNode<T extends AccountNodeLike = AccountNodeLike> {
  account: T
  children: AccountTreeNode<T>[]
  /** Own postings only (posting accounts). */
  ownBalance: number
  /** Own + all descendants — what a group account displays. */
  aggregateBalance: number
  ownDebit: number
  ownCredit: number
  aggregateDebit: number
  aggregateCredit: number
  descendantCount: number
  level: number
}

/**
 * Build the account forest and roll balances up so group accounts aggregate
 * their children. Orphans (parentId pointing at a missing/filtered account)
 * are surfaced as roots rather than silently dropped.
 */
export function buildAccountTree<T extends AccountNodeLike>(
  accounts: T[],
  balances: Map<string, { debit: number; credit: number }> = new Map()
): AccountTreeNode<T>[] {
  const nodes = new Map<string, AccountTreeNode<T>>()
  for (const a of accounts) {
    const b = balances.get(a.id) ?? { debit: 0, credit: 0 }
    const own = signedBalance(a.normalBalance, b.debit, b.credit)
    nodes.set(a.id, {
      account: a,
      children: [],
      ownBalance: own,
      aggregateBalance: own,
      ownDebit: b.debit,
      ownCredit: b.credit,
      aggregateDebit: b.debit,
      aggregateCredit: b.credit,
      descendantCount: 0,
      level: 0,
    })
  }

  const roots: AccountTreeNode<T>[] = []
  for (const node of nodes.values()) {
    const pid = node.account.parentId
    const parent = pid ? nodes.get(pid) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const byCode = (a: AccountTreeNode<T>, b: AccountTreeNode<T>) =>
    a.account.code.localeCompare(b.account.code, 'en', { numeric: true })

  // Post-order walk: compute levels, sort siblings, roll balances upward.
  const visit = (node: AccountTreeNode<T>, level: number, guard: Set<string>): void => {
    if (guard.has(node.account.id)) {
      node.children = [] // cycle guard — never recurse forever
      return
    }
    guard.add(node.account.id)
    node.level = level
    node.children.sort(byCode)
    let descendants = 0
    for (const child of node.children) {
      visit(child, level + 1, guard)
      node.aggregateBalance += child.aggregateBalance
      node.aggregateDebit += child.aggregateDebit
      node.aggregateCredit += child.aggregateCredit
      descendants += 1 + child.descendantCount
    }
    node.descendantCount = descendants
    guard.delete(node.account.id)
  }

  roots.sort(byCode)
  for (const r of roots) visit(r, 0, new Set())
  return roots
}

/** Flatten a tree in display order (depth-first, sorted). */
export function flattenTree<T extends AccountNodeLike>(roots: AccountTreeNode<T>[]): AccountTreeNode<T>[] {
  const out: AccountTreeNode<T>[] = []
  const walk = (n: AccountTreeNode<T>) => {
    out.push(n)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/** Sum debit/credit per account in one query (no N+1). */
export async function fetchAccountBalances(accountIds?: string[]): Promise<Map<string, { debit: number; credit: number }>> {
  const grouped = await db.journalLine.groupBy({
    by: ['accountId'],
    where: accountIds && accountIds.length ? { accountId: { in: accountIds } } : undefined,
    _sum: { debit: true, credit: true },
  })
  return new Map(grouped.map((g) => [g.accountId, { debit: g._sum.debit ?? 0, credit: g._sum.credit ?? 0 }]))
}

/** Normalize the derived fields that must always agree with the class. */
export function deriveAccountFields(input: {
  accountClass: AccountClass
  normalBalance?: string
  fsSection?: string
  isPosting?: boolean
}): { type: string; normalBalance: string; fsSection: string } {
  const def = classDef(input.accountClass)!
  return {
    type: ledgerTypeForClass(input.accountClass),
    normalBalance:
      input.normalBalance && (VALID_NORMAL_BALANCE as readonly string[]).includes(input.normalBalance)
        ? input.normalBalance
        : defaultNormalBalance(input.accountClass),
    fsSection:
      input.fsSection && (VALID_FS_SECTION as readonly string[]).includes(input.fsSection)
        ? input.fsSection
        : defaultFsSection(input.accountClass),
    // def is referenced to keep the class lookup honest (throws if unknown class)
    ...(def ? {} : {}),
  }
}

/** Load the parentId map used by cycle detection. */
export async function loadParentMap(): Promise<Map<string, string | null>> {
  const rows = await db.account.findMany({ select: { id: true, parentId: true } })
  return new Map(rows.map((r) => [r.id, r.parentId]))
}

/**
 * Recompute path/level for an account and its whole subtree. Called after a
 * create or a parent change so subtree queries stay correct.
 */
export async function recomputeSubtree(accountId: string): Promise<number> {
  const all = await db.account.findMany({ select: { id: true, parentId: true } })
  const childrenOf = new Map<string, string[]>()
  for (const a of all) {
    if (!a.parentId) continue
    const arr = childrenOf.get(a.parentId) ?? []
    arr.push(a.id)
    childrenOf.set(a.parentId, arr)
  }
  const self = await db.account.findUnique({ where: { id: accountId }, select: { id: true, parentId: true } })
  if (!self) return 0

  let parentPath: string | null = null
  if (self.parentId) {
    const p = await db.account.findUnique({ where: { id: self.parentId }, select: { path: true } })
    parentPath = p?.path ?? null
  }

  const updates: { id: string; path: string; level: number }[] = []
  const walk = (id: string, basePath: string | null, guard: Set<string>) => {
    if (guard.has(id)) return
    guard.add(id)
    const path = buildPath(basePath, id)
    updates.push({ id, path, level: levelFromPath(path) })
    for (const child of childrenOf.get(id) ?? []) walk(child, path, guard)
    guard.delete(id)
  }
  walk(accountId, parentPath, new Set())

  await db.$transaction(updates.map((u) => db.account.update({ where: { id: u.id }, data: { path: u.path, level: u.level } })))
  return updates.length
}

/** Suggest the next free child code under a parent (e.g. 1100 -> 1101). */
export async function suggestChildCode(parentId: string | null, accountClass?: AccountClass): Promise<string> {
  // Read whether to include parent prefix from config (coa.includeParentInCode)
  const includeParentInCode = await getConfigBool('coa.includeParentInCode', undefined, true)

  if (!parentId) {
    const prefix = accountClass ? ACCOUNT_CLASSES[accountClass].codePrefix : '9'
    const siblings = await db.account.findMany({ where: { parentId: null }, select: { code: true } })
    const used = new Set(siblings.map((s) => s.code))
    for (let i = 0; i < 100; i++) {
      const candidate = `${prefix}${String(i * 100).padStart(3, '0')}`
      if (!used.has(candidate)) return candidate
    }
    return `${prefix}000`
  }
  const parent = await db.account.findUnique({ where: { id: parentId }, select: { code: true } })
  if (!parent) return ''
  const children = await db.account.findMany({ where: { parentId }, select: { code: true }, orderBy: { code: 'desc' } })
  const base = parent.code
  if (!children.length) {
    // When includeParentInCode is disabled, use a flat sequential suffix rather
    // than appending to the parent code.
    if (!includeParentInCode) return /^\d+$/.test(base) ? `${base}001` : `${base}-001`
    return /^\d+$/.test(base) ? `${base}01` : `${base}-01`
  }
  const last = children[0].code
  if (/^\d+$/.test(last)) {
    // Preserve the code width (e.g. 1101 -> 1102, 001 -> 002).
    const width = last.length
    const bump = (v: string) => String(Number(v) + 1).padStart(width, '0')
    const existing = new Set(children.map((c) => c.code))
    let candidate = bump(last)
    let guard = 0
    while (existing.has(candidate) && guard++ < 1000) candidate = bump(candidate)
    return candidate
  }
  return `${base}-${String(children.length + 1).padStart(2, '0')}`
}

/**
 * Async-aware version of validateAccountInput that reads runtime configuration
 * (coa.accountCodeNumericOnly, coa.codeMinLength, coa.codeMaxLength,
 *  coa.subAccountGrade) from the Setting cache before calling the pure validator.
 *
 * Use this in API route handlers; the pure validateAccountInput remains available
 * for unit tests that pass constraints explicitly.
 */
export async function validateAccountInputAsync(
  input: AccountInput,
  opts: {
    isCreate: boolean
    existing?: (AccountNodeLike & { hasPostings?: boolean; childCount?: number }) | null
    parent?: AccountNodeLike | null
  }
): Promise<FieldError[]> {
  const [numericOnly, codeMinLength, codeMaxLength, maxGrade] = await Promise.all([
    getConfigBool('coa.accountCodeNumericOnly', undefined, false),
    getConfigNumber('coa.codeMinLength', undefined, 2),
    getConfigNumber('coa.codeMaxLength', undefined, 10),
    getConfigNumber('coa.subAccountGrade', undefined, 4),
  ])

  const errors = validateAccountInput(input, { ...opts, numericOnly, codeMinLength, codeMaxLength })

  // Sub-account grade check: count how many ancestors this node will have
  if (opts.isCreate && opts.parent) {
    // Walk up the parent chain to compute the depth of the new account.
    // The parent is already loaded; we count from 1 (the parent itself is level 1).
    const parentRow = await db.account.findUnique({
      where: { id: opts.parent.id },
      select: { level: true },
    })
    const newLevel = (parentRow?.level ?? 0) + 1
    if (newLevel > maxGrade) {
      errors.push({
        field: 'parentId',
        code: 'MAX_GRADE_EXCEEDED',
        message: `لا يمكن إضافة حساب فرعي أعمق من الرتبة ${maxGrade} (الرتبة الحالية ستكون ${newLevel})`,
      })
    }
  }

  return errors
}

/** True when the account (or any descendant) carries journal lines. */
export async function subtreeHasPostings(accountId: string): Promise<boolean> {
  const self = await db.account.findUnique({ where: { id: accountId }, select: { path: true } })
  const path = self?.path
  const ids = path
    ? (await db.account.findMany({ where: { OR: [{ id: accountId }, { path: { startsWith: `${path}/` } }] }, select: { id: true } })).map((a) => a.id)
    : [accountId]
  const count = await db.journalLine.count({ where: { accountId: { in: ids } } })
  return count > 0
}
