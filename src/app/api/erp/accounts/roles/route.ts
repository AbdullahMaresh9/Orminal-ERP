// GET    /api/erp/accounts/roles — role catalog + current mappings (determination)
// PUT    /api/erp/accounts/roles — assign a role to an account
// DELETE /api/erp/accounts/roles?role=X — unmap a role
//
// This is the ONLY way business modules learn which account to post to.

import { db } from '@/lib/db'
import { ok, serverError, badRequest, notFound, unprocessableEntity } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { writeAudit } from '@/lib/erp/audit'
import { ACCOUNT_ROLES, isValidRole, roleAcceptsClass } from '@/lib/erp/account-roles'
import { SCOPE_ANY } from '@/lib/erp/account-determination'

export async function GET(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.CONFIG, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId') ?? auth.companyId ?? SCOPE_ANY
    const branchId = url.searchParams.get('branchId') ?? SCOPE_ANY

    const mappings = await db.accountRoleMapping.findMany({
      where: {
        OR: [
          { companyId, branchId },
          { companyId, branchId: SCOPE_ANY },
          { companyId: SCOPE_ANY, branchId: SCOPE_ANY },
        ],
      },
      include: {
        account: { select: { id: true, code: true, nameAr: true, nameEn: true, isPosting: true, active: true, accountClass: true } },
      },
    })

    // Most specific mapping wins, mirroring the resolver's precedence.
    const rank = (m: { companyId: string; branchId: string }) =>
      m.companyId === companyId && m.branchId === branchId && branchId !== SCOPE_ANY ? 3
        : m.companyId === companyId && m.branchId === SCOPE_ANY ? 2 : 1
    const best = new Map<string, (typeof mappings)[number]>()
    for (const m of mappings) {
      const cur = best.get(m.role)
      if (!cur || rank(m) > rank(cur)) best.set(m.role, m)
    }

    const data = ACCOUNT_ROLES.map((r) => {
      const m = best.get(r.code)
      return {
        role: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        group: r.group,
        required: r.required,
        descriptionAr: r.descriptionAr,
        allowedClasses: r.allowedClasses,
        mapping: m
          ? { id: m.id, companyId: m.companyId, branchId: m.branchId, active: m.active, account: m.account }
          : null,
      }
    })

    return ok({
      scope: { companyId, branchId },
      roles: data,
      missingRequired: data.filter((d) => d.required && (!d.mapping || !d.mapping.active)).map((d) => d.role),
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.CONFIG, 'canUpdate')
  if (isAuthFailure(auth)) return auth

  try {
    const body = await req.json()
    const role: string = body.role
    const accountId: string = body.accountId
    const companyId: string = body.companyId ?? auth.companyId ?? SCOPE_ANY
    const branchId: string = body.branchId ?? SCOPE_ANY

    if (!role) return badRequest('role مطلوب')
    if (!accountId) return badRequest('accountId مطلوب')
    if (!isValidRole(role)) return badRequest(`الدور "${role}" غير معروف`, 'UNKNOWN_ROLE')

    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { id: true, code: true, nameAr: true, isPosting: true, active: true, accountClass: true },
    })
    if (!account) return notFound('الحساب غير موجود')

    const errors: { field: string; code: string; message: string }[] = []
    if (!account.isPosting) {
      errors.push({ field: 'accountId', code: 'NOT_POSTING', message: `الحساب "${account.code}" حساب مجمّع — الأدوار تُسند لحسابات الترحيل فقط` })
    }
    if (!account.active) {
      errors.push({ field: 'accountId', code: 'INACTIVE', message: `الحساب "${account.code}" غير نشط` })
    }
    if (!roleAcceptsClass(role, account.accountClass)) {
      errors.push({ field: 'accountId', code: 'CLASS_MISMATCH', message: `الدور "${role}" لا يقبل فئة "${account.accountClass}"` })
    }
    if (errors.length) return unprocessableEntity('لا يمكن ربط الدور بهذا الحساب', errors)

    const previous = await db.accountRoleMapping.findUnique({
      where: { companyId_branchId_role: { companyId, branchId, role } },
      include: { account: { select: { code: true, nameAr: true } } },
    })

    const mapping = await db.accountRoleMapping.upsert({
      where: { companyId_branchId_role: { companyId, branchId, role } },
      create: { companyId, branchId, role, accountId, active: true, createdBy: auth.userId, updatedBy: auth.userId },
      update: { accountId, active: true, updatedBy: auth.userId },
      include: { account: { select: { id: true, code: true, nameAr: true, accountClass: true } } },
    })

    await writeAudit({
      userId: auth.userId,
      companyId: auth.companyId,
      moduleCode: 'FIN',
      documentType: 'account_role_mapping',
      documentId: mapping.id,
      action: 'configure',
      oldValue: previous ? { role, accountCode: previous.account.code, active: previous.active } : null,
      newValue: { role, accountCode: mapping.account.code, scope: { companyId, branchId } },
      reason: body.reason ?? null,
    })

    return ok(mapping)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.CONFIG, 'canUpdate')
  if (isAuthFailure(auth)) return auth

  try {
    const url = new URL(req.url)
    const role = url.searchParams.get('role')
    const companyId = url.searchParams.get('companyId') ?? auth.companyId ?? SCOPE_ANY
    const branchId = url.searchParams.get('branchId') ?? SCOPE_ANY
    if (!role) return badRequest('role مطلوب')

    const existing = await db.accountRoleMapping.findUnique({
      where: { companyId_branchId_role: { companyId, branchId, role } },
      include: { account: { select: { code: true } } },
    })
    if (!existing) return notFound('لا يوجد ربط لهذا الدور في هذا النطاق')

    const roleDef = ACCOUNT_ROLES.find((r) => r.code === role)
    if (roleDef?.required) {
      return badRequest(
        `الدور "${role}" إلزامي لعمل محرك القيود — أعد ربطه بحساب آخر بدلاً من إزالته`,
        'REQUIRED_ROLE'
      )
    }

    await db.accountRoleMapping.delete({ where: { id: existing.id } })

    await writeAudit({
      userId: auth.userId,
      companyId: auth.companyId,
      moduleCode: 'FIN',
      documentType: 'account_role_mapping',
      documentId: existing.id,
      action: 'delete',
      oldValue: { role, accountCode: existing.account.code, scope: { companyId, branchId } },
      reason: url.searchParams.get('reason'),
    })

    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
