// POST /api/erp/accounts/:id/deactivate — explicit deactivate / reactivate.
// Body: { active: boolean, reason?: string }
// Deactivation cascades to the subtree; reactivation requires an active parent.

import { db } from '@/lib/db'
import { ok, notFound, serverError, conflict, badRequest } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { auditAccount } from '@/lib/erp/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canDelete')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const nextActive = Boolean(body.active)
    const reason: string | null = body.reason ?? null

    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, code: true, nameAr: true, active: true, path: true, parentId: true },
    })
    if (!account) return notFound('الحساب غير موجود')
    if (account.active === nextActive) return ok({ success: true, unchanged: true, active: nextActive })

    const subtreeIds = account.path
      ? (await db.account.findMany({ where: { path: { startsWith: `${account.path}/` } }, select: { id: true } })).map((a) => a.id)
      : []

    if (!nextActive) {
      // Refuse to strand an account role on an inactive account.
      const activeRoles = await db.accountRoleMapping.findMany({
        where: { accountId: { in: [id, ...subtreeIds] }, active: true },
        select: { role: true },
      })
      if (activeRoles.length) {
        return conflict(
          `لا يمكن التعطيل: الحساب (أو أحد فروعه) مرتبط بأدوار نظامية (${activeRoles.map((r) => r.role).join(', ')})`,
          'ACCOUNT_ROLE_IN_USE'
        )
      }
    } else if (account.parentId) {
      const parent = await db.account.findUnique({ where: { id: account.parentId }, select: { active: true, code: true } })
      if (parent && !parent.active) {
        return badRequest(`لا يمكن التنشيط: الحساب الأب "${parent.code}" غير نشط`, 'PARENT_INACTIVE')
      }
    }

    await db.$transaction(async (tx) => {
      await tx.account.update({
        where: { id },
        data: nextActive
          ? { active: true, deactivatedAt: null, deactivatedBy: null, updatedBy: auth.userId }
          : { active: false, deactivatedAt: new Date(), deactivatedBy: auth.userId, updatedBy: auth.userId },
      })
      if (!nextActive && subtreeIds.length) {
        await tx.account.updateMany({
          where: { id: { in: subtreeIds }, active: true },
          data: { active: false, deactivatedAt: new Date(), deactivatedBy: auth.userId, updatedBy: auth.userId },
        })
      }
    })

    await auditAccount({
      userId: auth.userId,
      companyId: auth.companyId,
      accountId: id,
      action: nextActive ? 'reactivate' : 'deactivate',
      oldValue: { active: account.active },
      newValue: { active: nextActive, cascadedTo: nextActive ? 0 : subtreeIds.length },
      reason,
    })

    return ok({ success: true, active: nextActive, cascadedTo: nextActive ? 0 : subtreeIds.length })
  } catch (e: any) {
    return serverError(e.message)
  }
}
