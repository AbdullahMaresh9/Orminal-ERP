// GET  /api/erp/accounts — chart of accounts (flat list or hierarchical tree)
// POST /api/erp/accounts — create a group or posting account
//
// Balances are DERIVED from JournalLine (Account.balance is only a cache) and
// group accounts aggregate their whole subtree.

import { db } from '@/lib/db'
import {
  created,
  list,
  ok,
  serverError,
  unprocessableEntity,
  parsePagination,
  parseSearch,
  conflict,
} from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { buildAccountTree, fetchAccountBalances } from '@/lib/erp/account-service'
import { signedBalance } from '@/lib/erp/account-classes'
import { createAccount } from '@/lib/erp/account-write'

export const ACCOUNT_FIELDS = {
  id: true,
  code: true,
  nameAr: true,
  nameEn: true,
  shortName: true,
  accountClass: true,
  type: true,
  subtype: true,
  parentId: true,
  isPosting: true,
  isSystem: true,
  normalBalance: true,
  currencyId: true,
  allowReconciliation: true,
  allowManualEntry: true,
  taxBehavior: true,
  taxCodeId: true,
  fsSection: true,
  reportCategory: true,
  reportSubcategory: true,
  reportTags: true,
  requireCostCenter: true,
  requireBranch: true,
  requireProject: true,
  level: true,
  path: true,
  balance: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const url = new URL(req.url)
    const q = parseSearch(req)
    const view = url.searchParams.get('view') ?? (url.searchParams.get('tree') === 'true' ? 'tree' : 'flat')
    const accountClass = url.searchParams.get('class')
    const type = url.searchParams.get('type')
    const active = url.searchParams.get('active')
    const isPosting = url.searchParams.get('isPosting')
    const isSystem = url.searchParams.get('isSystem')
    const parentId = url.searchParams.get('parentId')
    const sortBy = url.searchParams.get('sortBy') ?? 'code'
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { shortName: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (accountClass) where.accountClass = accountClass
    if (type) where.type = type
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (isPosting === 'true') where.isPosting = true
    if (isPosting === 'false') where.isPosting = false
    if (isSystem === 'true') where.isSystem = true
    if (isSystem === 'false') where.isSystem = false
    if (parentId) where.parentId = parentId === 'null' ? null : parentId

    // System roles shown next to each account.
    const mappings = await db.accountRoleMapping.findMany({
      where: { active: true },
      select: { role: true, accountId: true },
    })
    const rolesByAccount = new Map<string, string[]>()
    for (const m of mappings) {
      const arr = rolesByAccount.get(m.accountId) ?? []
      arr.push(m.role)
      rolesByAccount.set(m.accountId, arr)
    }

    // ---------------- TREE VIEW ----------------
    // The whole chart is loaded once (bounded master data) so group accounts can
    // aggregate their descendants. Filters keep matched nodes *and* their
    // ancestors so the branch stays reachable.
    if (view === 'tree') {
      const [all, balances] = await Promise.all([
        db.account.findMany({ select: ACCOUNT_FIELDS, orderBy: { code: 'asc' } }),
        fetchAccountBalances(),
      ])

      const hasFilter = Boolean(q || accountClass || type || active || isPosting || isSystem)
      let visibleIds: Set<string> | null = null
      if (hasFilter) {
        const matched = await db.account.findMany({ where, select: { id: true, path: true } })
        visibleIds = new Set<string>()
        for (const m of matched) {
          visibleIds.add(m.id)
          for (const seg of (m.path ?? '').split('/').filter(Boolean)) visibleIds.add(seg)
        }
      }

      const scoped = visibleIds ? all.filter((a) => visibleIds!.has(a.id)) : all
      const roots = buildAccountTree(scoped as any, balances)

      type Node = (typeof roots)[number]
      const serialize = (node: Node): Record<string, unknown> => ({
        ...node.account,
        roles: rolesByAccount.get(node.account.id) ?? [],
        ownBalance: node.ownBalance,
        balance: node.aggregateBalance,
        aggregateBalance: node.aggregateBalance,
        aggregateDebit: node.aggregateDebit,
        aggregateCredit: node.aggregateCredit,
        descendantCount: node.descendantCount,
        depth: node.level,
        children: node.children.map(serialize),
      })

      return ok({ tree: roots.map(serialize), totalAccounts: scoped.length })
    }

    // ---------------- FLAT VIEW ----------------
    const { page, pageSize, skip } = parsePagination(req)
    const orderBy = ['code', 'nameAr', 'accountClass', 'level'].includes(sortBy)
      ? { [sortBy]: sortDir }
      : { code: sortDir }

    const [rows, total] = await Promise.all([
      db.account.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          ...ACCOUNT_FIELDS,
          parent: { select: { id: true, code: true, nameAr: true } },
          _count: { select: { children: true, journalLines: true } },
        },
        orderBy: orderBy as never,
      }),
      db.account.count({ where }),
    ])

    const balances = await fetchAccountBalances(rows.map((r) => r.id))

    // Subtree aggregation for the group accounts on this page.
    const groupPaths = rows.filter((r) => !r.isPosting && r.path).map((r) => r.path as string)
    const aggregateByPath = new Map<string, { debit: number; credit: number }>()
    if (groupPaths.length) {
      const descendants = await db.account.findMany({
        where: { OR: groupPaths.map((p) => ({ path: { startsWith: `${p}/` } })) },
        select: { id: true, path: true },
      })
      const descBalances = await fetchAccountBalances(descendants.map((d) => d.id))
      for (const p of groupPaths) {
        let debit = 0
        let credit = 0
        for (const d of descendants) {
          if (!d.path?.startsWith(`${p}/`)) continue
          const b = descBalances.get(d.id)
          if (!b) continue
          debit += b.debit
          credit += b.credit
        }
        aggregateByPath.set(p, { debit, credit })
      }
    }

    const data = rows.map((r) => {
      const own = balances.get(r.id) ?? { debit: 0, credit: 0 }
      const agg = r.path ? aggregateByPath.get(r.path) : undefined
      const totalDebit = own.debit + (agg?.debit ?? 0)
      const totalCredit = own.credit + (agg?.credit ?? 0)
      return {
        ...r,
        roles: rolesByAccount.get(r.id) ?? [],
        childCount: r._count.children,
        lineCount: r._count.journalLines,
        sumDebit: totalDebit,
        sumCredit: totalCredit,
        ownBalance: signedBalance(r.normalBalance, own.debit, own.credit),
        computedBalance: signedBalance(r.normalBalance, totalDebit, totalCredit),
      }
    })

    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canCreate')
  if (isAuthFailure(auth)) return auth

  try {
    const body = await req.json()
    const result = await createAccount(body, { userId: auth.userId, companyId: auth.companyId })
    if (result.kind === 'invalid') return unprocessableEntity('بيانات الحساب غير صحيحة', result.errors)
    if (result.kind === 'conflict') return conflict(result.message, result.code)
    return created(result.account)
  } catch (e: any) {
    return serverError(e.message)
  }
}
