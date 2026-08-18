// GET  /api/erp/accounts/:id/children — direct children of an account
// POST /api/erp/accounts/:id/children — create a child under this account
// Creation rules live in account-write.ts (shared with POST /accounts).

import { db } from '@/lib/db'
import { created, list, notFound, serverError, unprocessableEntity, conflict, badRequest } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { createAccount } from '@/lib/erp/account-write'
import { fetchAccountBalances, suggestChildCode } from '@/lib/erp/account-service'
import { signedBalance } from '@/lib/erp/account-classes'
import type { AccountClass } from '@/lib/erp/account-classes'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth
  try {
    const { id } = await params
    const parent = await db.account.findUnique({ where: { id }, select: { id: true, accountClass: true } })
    if (!parent) return notFound('الحساب غير موجود')

    const children = await db.account.findMany({
      where: { parentId: id },
      orderBy: { code: 'asc' },
      include: { _count: { select: { children: true, journalLines: true } } },
    })
    const balances = await fetchAccountBalances(children.map((c) => c.id))
    const data = children.map((c) => {
      const b = balances.get(c.id) ?? { debit: 0, credit: 0 }
      return {
        ...c,
        childCount: c._count.children,
        lineCount: c._count.journalLines,
        computedBalance: signedBalance(c.normalBalance, b.debit, b.credit),
      }
    })
    return list(data, data.length, 1, data.length || 1)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canCreate')
  if (isAuthFailure(auth)) return auth
  try {
    const { id } = await params
    const parent = await db.account.findUnique({
      where: { id },
      select: { id: true, code: true, isPosting: true, accountClass: true, active: true },
    })
    if (!parent) return notFound('الحساب الأب غير موجود')
    if (parent.isPosting) {
      return badRequest(
        `الحساب "${parent.code}" حساب ترحيل ولا يقبل حسابات فرعية — حوّله إلى حساب مجمّع أولاً`,
        'PARENT_NOT_GROUP'
      )
    }

    const body = await req.json().catch(() => ({}))
    // The parent always wins: class is inherited, parentId is forced.
    const payload = {
      ...body,
      parentId: id,
      accountClass: parent.accountClass,
      code: (body.code ?? '').trim() || (await suggestChildCode(id, parent.accountClass as AccountClass)),
    }

    const result = await createAccount(payload, { userId: auth.userId, companyId: auth.companyId })
    if (result.kind === 'invalid') return unprocessableEntity('بيانات الحساب الفرعي غير صحيحة', result.errors)
    if (result.kind === 'conflict') return conflict(result.message, result.code)
    return created(result.account)
  } catch (e: any) {
    return serverError(e.message)
  }
}
