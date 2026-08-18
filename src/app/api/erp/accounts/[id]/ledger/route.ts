// GET /api/erp/accounts/:id/ledger — account statement with a running balance.
// Query: from, to, page, pageSize, includeChildren=true (group accounts)

import { db } from '@/lib/db'
import { ok, notFound, serverError, parsePagination } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { signedBalance } from '@/lib/erp/account-classes'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.LEDGER, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const url = new URL(req.url)
    const { page, pageSize, skip } = parsePagination(req)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const includeChildren = url.searchParams.get('includeChildren') !== 'false'

    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, code: true, nameAr: true, nameEn: true, normalBalance: true, isPosting: true, path: true, accountClass: true },
    })
    if (!account) return notFound('الحساب غير موجود')

    // A group account has no postings of its own — report over its subtree.
    let accountIds = [id]
    if (includeChildren && !account.isPosting && account.path) {
      const descendants = await db.account.findMany({
        where: { path: { startsWith: `${account.path}/` } },
        select: { id: true },
      })
      accountIds = [id, ...descendants.map((d) => d.id)]
    }

    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)
    const entryWhere = Object.keys(dateFilter).length ? { postingDate: dateFilter, state: 'posted' } : { state: 'posted' }

    // Opening balance = everything strictly before `from`.
    let openingDebit = 0
    let openingCredit = 0
    if (from) {
      const opening = await db.journalLine.aggregate({
        where: { accountId: { in: accountIds }, entry: { postingDate: { lt: new Date(from) }, state: 'posted' } },
        _sum: { debit: true, credit: true },
      })
      openingDebit = opening._sum.debit ?? 0
      openingCredit = opening._sum.credit ?? 0
    }
    const openingBalance = signedBalance(account.normalBalance, openingDebit, openingCredit)

    const [lines, total, periodTotals] = await Promise.all([
      db.journalLine.findMany({
        where: { accountId: { in: accountIds }, entry: entryWhere },
        skip,
        take: pageSize,
        orderBy: [{ entry: { postingDate: 'asc' } }, { id: 'asc' }],
        select: {
          id: true,
          debit: true,
          credit: true,
          description: true,
          account: { select: { id: true, code: true, nameAr: true } },
          partner: { select: { id: true, code: true, nameAr: true } },
          costCenter: { select: { id: true, code: true, nameAr: true } },
          entry: { select: { id: true, code: true, postingDate: true, description: true, refType: true, refId: true, state: true } },
        },
      }),
      db.journalLine.count({ where: { accountId: { in: accountIds }, entry: entryWhere } }),
      db.journalLine.aggregate({
        where: { accountId: { in: accountIds }, entry: entryWhere },
        _sum: { debit: true, credit: true },
      }),
    ])

    // Running balance continues from the opening balance + everything on prior pages.
    let running = openingBalance
    if (skip > 0) {
      const prior = await db.journalLine.findMany({
        where: { accountId: { in: accountIds }, entry: entryWhere },
        take: skip,
        orderBy: [{ entry: { postingDate: 'asc' } }, { id: 'asc' }],
        select: { debit: true, credit: true },
      })
      for (const l of prior) running += signedBalance(account.normalBalance, l.debit, l.credit)
    }

    const rows = lines.map((l) => {
      running += signedBalance(account.normalBalance, l.debit, l.credit)
      return { ...l, runningBalance: Math.round(running * 100) / 100 }
    })

    const periodDebit = periodTotals._sum.debit ?? 0
    const periodCredit = periodTotals._sum.credit ?? 0

    return ok({
      account,
      scope: { accountIds, includeChildren: accountIds.length > 1 },
      opening: { debit: openingDebit, credit: openingCredit, balance: openingBalance },
      period: { debit: periodDebit, credit: periodCredit, movement: signedBalance(account.normalBalance, periodDebit, periodCredit) },
      closing: { balance: Math.round((openingBalance + signedBalance(account.normalBalance, periodDebit, periodCredit)) * 100) / 100 },
      lines: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1, hasMore: page * pageSize < total },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
