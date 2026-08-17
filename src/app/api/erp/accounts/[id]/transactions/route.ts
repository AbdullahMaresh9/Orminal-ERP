// GET /api/erp/accounts/:id/transactions — journal entries touching this account.

import { db } from '@/lib/db'
import { list, notFound, serverError, parsePagination } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.LEDGER, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const url = new URL(req.url)
    const { page, pageSize, skip } = parsePagination(req)
    const state = url.searchParams.get('state')

    const account = await db.account.findUnique({ where: { id }, select: { id: true, isPosting: true, path: true } })
    if (!account) return notFound('الحساب غير موجود')

    let accountIds = [id]
    if (!account.isPosting && account.path) {
      const descendants = await db.account.findMany({ where: { path: { startsWith: `${account.path}/` } }, select: { id: true } })
      accountIds = [id, ...descendants.map((d) => d.id)]
    }

    const where = {
      lines: { some: { accountId: { in: accountIds } } },
      ...(state ? { state } : {}),
    }

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { postingDate: 'desc' },
        select: {
          id: true,
          code: true,
          postingDate: true,
          description: true,
          refType: true,
          refId: true,
          state: true,
          totalDebit: true,
          totalCredit: true,
          journal: { select: { code: true, nameAr: true } },
          lines: {
            where: { accountId: { in: accountIds } },
            select: { id: true, debit: true, credit: true, description: true, account: { select: { id: true, code: true, nameAr: true } } },
          },
        },
      }),
      db.journalEntry.count({ where }),
    ])

    return list(entries, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}
