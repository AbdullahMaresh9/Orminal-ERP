// GET    /api/erp/accounts/:id — full account detail (all tabs)
// PUT    /api/erp/accounts/:id — update (with immutability + hierarchy rules)
// DELETE /api/erp/accounts/:id — deactivate by default; ?hard=true only for a
//        never-used, non-system, childless account.

import { db } from '@/lib/db'
import { ok, notFound, serverError, unprocessableEntity, conflict, badRequest } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { auditAccount, diffFields } from '@/lib/erp/audit'
import {
  deriveAccountFields,
  fetchAccountBalances,
  loadParentMap,
  recomputeSubtree,
  validateAccountInput,
  wouldCreateCycle,
  type AccountInput,
} from '@/lib/erp/account-service'
import { isAccountClass, signedBalance, type AccountClass } from '@/lib/erp/account-classes'
import { SCOPE_ANY } from '@/lib/erp/account-determination'
import { isValidRole } from '@/lib/erp/account-roles'

const DETAIL_INCLUDE = {
  parent: { select: { id: true, code: true, nameAr: true, nameEn: true, isPosting: true, accountClass: true } },
  children: {
    select: { id: true, code: true, nameAr: true, nameEn: true, isPosting: true, active: true, normalBalance: true, accountClass: true },
    orderBy: { code: 'asc' as const },
  },
  currency: { select: { id: true, code: true, nameAr: true, symbol: true } },
  taxCode: { select: { id: true, code: true, nameAr: true, rate: true } },
  roleMappings: { select: { id: true, role: true, companyId: true, branchId: true, active: true } },
  _count: { select: { children: true, journalLines: true } },
} as const

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const item = await db.account.findUnique({ where: { id }, include: DETAIL_INCLUDE })
    if (!item) return notFound('الحساب غير موجود')

    // Own balance
    const own = (await fetchAccountBalances([id])).get(id) ?? { debit: 0, credit: 0 }

    // Subtree aggregate (group accounts)
    let aggDebit = own.debit
    let aggCredit = own.credit
    let descendantCount = 0
    if (item.path) {
      const descendants = await db.account.findMany({
        where: { path: { startsWith: `${item.path}/` } },
        select: { id: true },
      })
      descendantCount = descendants.length
      if (descendants.length) {
        const descBalances = await fetchAccountBalances(descendants.map((d) => d.id))
        for (const b of descBalances.values()) {
          aggDebit += b.debit
          aggCredit += b.credit
        }
      }
    }

    // Breadcrumb from the materialized path
    const ancestorIds = (item.path ?? '').split('/').filter(Boolean).filter((x) => x !== id)
    const ancestors = ancestorIds.length
      ? await db.account.findMany({
          where: { id: { in: ancestorIds } },
          select: { id: true, code: true, nameAr: true, nameEn: true, level: true },
          orderBy: { level: 'asc' },
        })
      : []

    const lastMovement = await db.journalLine.findFirst({
      where: { accountId: id },
      select: { entry: { select: { postingDate: true, code: true } } },
      orderBy: { entry: { postingDate: 'desc' } },
    })

    return ok({
      ...item,
      breadcrumb: ancestors,
      childCount: item._count.children,
      lineCount: item._count.journalLines,
      descendantCount,
      sumDebit: own.debit,
      sumCredit: own.credit,
      ownBalance: signedBalance(item.normalBalance, own.debit, own.credit),
      computedBalance: signedBalance(item.normalBalance, aggDebit, aggCredit),
      aggregateDebit: aggDebit,
      aggregateCredit: aggCredit,
      roles: item.roleMappings.filter((m) => m.active).map((m) => m.role),
      lastMovementDate: lastMovement?.entry.postingDate ?? null,
      lastMovementEntry: lastMovement?.entry.code ?? null,
      // capability hints so the UI never offers an action the server will reject
      canDelete: item._count.journalLines === 0 && item._count.children === 0 && !item.isSystem,
      canConvertToGroup: item._count.journalLines === 0,
      canConvertToPosting: item._count.children === 0,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canUpdate')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const body = (await req.json()) as AccountInput & { reason?: string }

    const existing = await db.account.findUnique({
      where: { id },
      include: { _count: { select: { children: true, journalLines: true } } },
    })
    if (!existing) return notFound('الحساب غير موجود')

    const parent = body.parentId
      ? await db.account.findUnique({
          where: { id: body.parentId },
          select: {
            id: true, code: true, nameAr: true, parentId: true, isPosting: true,
            accountClass: true, normalBalance: true, active: true, isSystem: true, path: true,
          },
        })
      : null

    const errors = validateAccountInput(body, {
      isCreate: false,
      existing: {
        id: existing.id,
        code: existing.code,
        nameAr: existing.nameAr,
        parentId: existing.parentId,
        isPosting: existing.isPosting,
        accountClass: existing.accountClass,
        normalBalance: existing.normalBalance,
        active: existing.active,
        isSystem: existing.isSystem,
        hasPostings: existing._count.journalLines > 0,
        childCount: existing._count.children,
      },
      parent,
    })
    if (errors.length) return unprocessableEntity('بيانات الحساب غير صحيحة', errors)

    // Duplicate code guard
    if (body.code && body.code.trim() !== existing.code) {
      const dup = await db.account.findUnique({ where: { code: body.code.trim() } })
      if (dup) return conflict(`رمز الحساب "${body.code.trim()}" مستخدم بالفعل`, 'DUPLICATE_CODE')
    }

    // Cycle guard on parent change
    const parentChanged = body.parentId !== undefined && (body.parentId || null) !== existing.parentId
    if (parentChanged) {
      const parentMap = await loadParentMap()
      if (wouldCreateCycle(id, body.parentId || null, parentMap)) {
        return unprocessableEntity('تغيير الحساب الأب ينشئ حلقة دائرية في الشجرة', [
          { field: 'parentId', code: 'CIRCULAR_HIERARCHY', message: 'لا يمكن نقل حساب ليصبح تابعاً لأحد فروعه', rejectedValue: body.parentId },
        ])
      }
    }

    const accountClass = (body.accountClass ?? existing.accountClass) as AccountClass
    if (!isAccountClass(accountClass)) {
      return unprocessableEntity('فئة الحساب غير صحيحة', [{ field: 'accountClass', code: 'INVALID', message: 'فئة غير معروفة' }])
    }
    const derived = deriveAccountFields({
      accountClass,
      normalBalance: body.normalBalance ?? existing.normalBalance,
      fsSection: body.fsSection ?? existing.fsSection,
      isPosting: body.isPosting ?? existing.isPosting,
    })

    // System accounts: names, reporting metadata and dimension rules only.
    const data: Record<string, unknown> = existing.isSystem
      ? {
          nameAr: body.nameAr?.trim() ?? existing.nameAr,
          nameEn: body.nameEn?.trim() ?? existing.nameEn,
          shortName: body.shortName?.trim() ?? existing.shortName,
          reportCategory: body.reportCategory ?? existing.reportCategory,
          reportSubcategory: body.reportSubcategory ?? existing.reportSubcategory,
          reportTags: Array.isArray(body.reportTags) ? JSON.stringify(body.reportTags) : body.reportTags ?? existing.reportTags,
          allowReconciliation: body.allowReconciliation ?? existing.allowReconciliation,
          requireCostCenter: body.requireCostCenter ?? existing.requireCostCenter,
          requireBranch: body.requireBranch ?? existing.requireBranch,
          requireProject: body.requireProject ?? existing.requireProject,
          currencyId: body.currencyId !== undefined ? body.currencyId || null : existing.currencyId,
          taxBehavior: body.taxBehavior ?? existing.taxBehavior,
          taxCodeId: body.taxCodeId !== undefined ? body.taxCodeId || null : existing.taxCodeId,
          active: body.active ?? existing.active,
          updatedBy: auth.userId,
        }
      : {
          code: body.code?.trim() ?? existing.code,
          nameAr: body.nameAr?.trim() ?? existing.nameAr,
          nameEn: body.nameEn?.trim() ?? existing.nameEn,
          shortName: body.shortName?.trim() ?? existing.shortName,
          accountClass,
          type: derived.type,
          subtype: body.subtype !== undefined ? body.subtype || null : existing.subtype,
          parentId: body.parentId !== undefined ? body.parentId || null : existing.parentId,
          isPosting: body.isPosting ?? existing.isPosting,
          normalBalance: derived.normalBalance,
          currencyId: body.currencyId !== undefined ? body.currencyId || null : existing.currencyId,
          allowReconciliation: body.allowReconciliation ?? existing.allowReconciliation,
          allowManualEntry: body.allowManualEntry ?? existing.allowManualEntry,
          taxBehavior: body.taxBehavior ?? existing.taxBehavior,
          taxCodeId: body.taxCodeId !== undefined ? body.taxCodeId || null : existing.taxCodeId,
          fsSection: derived.fsSection,
          reportCategory: body.reportCategory !== undefined ? body.reportCategory || null : existing.reportCategory,
          reportSubcategory: body.reportSubcategory !== undefined ? body.reportSubcategory || null : existing.reportSubcategory,
          reportTags: Array.isArray(body.reportTags) ? JSON.stringify(body.reportTags) : body.reportTags ?? existing.reportTags,
          requireCostCenter: body.requireCostCenter ?? existing.requireCostCenter,
          requireBranch: body.requireBranch ?? existing.requireBranch,
          requireProject: body.requireProject ?? existing.requireProject,
          active: body.active ?? existing.active,
          updatedBy: auth.userId,
        }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.account.update({ where: { id }, data: data as never })

      // Role (re)assignment — the mapping table is the source of truth.
      if (body.role !== undefined) {
        if (body.role && isValidRole(body.role)) {
          await tx.accountRoleMapping.upsert({
            where: {
              companyId_branchId_role: {
                companyId: auth.companyId ?? SCOPE_ANY,
                branchId: SCOPE_ANY,
                role: body.role,
              },
            },
            create: {
              companyId: auth.companyId ?? SCOPE_ANY,
              branchId: SCOPE_ANY,
              role: body.role,
              accountId: id,
              createdBy: auth.userId,
              updatedBy: auth.userId,
            },
            update: { accountId: id, active: true, updatedBy: auth.userId },
          })
        } else if (body.role === null || body.role === '') {
          // Detach every role currently pointing at this account in the user's scope.
          await tx.accountRoleMapping.updateMany({
            where: { accountId: id, companyId: auth.companyId ?? SCOPE_ANY },
            data: { active: false, updatedBy: auth.userId },
          })
        }
      }

      return row
    })

    // Parent moved → refresh path/level for the whole subtree.
    if (parentChanged) await recomputeSubtree(id)

    const audited = [
      'code', 'nameAr', 'nameEn', 'shortName', 'accountClass', 'type', 'subtype', 'parentId',
      'isPosting', 'normalBalance', 'currencyId', 'allowReconciliation', 'allowManualEntry',
      'taxBehavior', 'taxCodeId', 'fsSection', 'reportCategory', 'reportSubcategory',
      'requireCostCenter', 'requireBranch', 'requireProject', 'active',
    ] as const
    const changes = diffFields(existing as unknown as Record<string, unknown>, data, audited as unknown as readonly string[])
    if (changes.changed.length) {
      await auditAccount({
        userId: auth.userId,
        companyId: auth.companyId,
        accountId: id,
        action: 'update',
        oldValue: changes.old,
        newValue: changes.new,
        reason: body.reason ?? null,
      })
    }

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canDelete')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const url = new URL(req.url)
    const hard = url.searchParams.get('hard') === 'true'
    const reason = url.searchParams.get('reason')

    const existing = await db.account.findUnique({
      where: { id },
      include: { _count: { select: { children: true, journalLines: true, roleMappings: true } } },
    })
    if (!existing) return notFound('الحساب غير موجود')

    // --- HARD DELETE: only a pristine, non-system, childless, unused account ---
    if (hard) {
      if (existing.isSystem) return badRequest('لا يمكن حذف حساب نظامي — استخدم التعطيل', 'SYSTEM_ACCOUNT')
      if (existing._count.journalLines > 0) {
        return conflict('لا يمكن حذف حساب له قيود مرحّلة — يجب تعطيله للحفاظ على السجل التاريخي', 'ACCOUNT_HAS_POSTINGS')
      }
      if (existing._count.children > 0) return conflict('لا يمكن حذف حساب له حسابات فرعية', 'ACCOUNT_HAS_CHILDREN')
      if (existing._count.roleMappings > 0) {
        return conflict('الحساب مرتبط بدور نظامي — أزل الربط من تحديد الحسابات أولاً', 'ACCOUNT_HAS_ROLE')
      }

      await db.account.delete({ where: { id } })
      await auditAccount({
        userId: auth.userId,
        companyId: auth.companyId,
        accountId: id,
        action: 'delete',
        oldValue: { code: existing.code, nameAr: existing.nameAr, accountClass: existing.accountClass },
        reason,
      })
      return ok({ success: true, deleted: true, mode: 'hard' })
    }

    // --- DEFAULT: non-destructive deactivation (preserves history) ---
    if (!existing.active) return ok({ success: true, alreadyInactive: true })

    // A group account cannot be left active above deactivated children silently:
    // deactivating a group deactivates its subtree, which we do explicitly.
    const subtreeIds = existing.path
      ? (await db.account.findMany({ where: { path: { startsWith: `${existing.path}/` } }, select: { id: true } })).map((a) => a.id)
      : []

    const activeRoles = await db.accountRoleMapping.findMany({
      where: { accountId: { in: [id, ...subtreeIds] }, active: true },
      select: { role: true, accountId: true },
    })
    if (activeRoles.length) {
      return conflict(
        `لا يمكن تعطيل الحساب: مرتبط بأدوار نظامية (${activeRoles.map((r) => r.role).join(', ')}). أعد ربط هذه الأدوار بحساب آخر أولاً.`,
        'ACCOUNT_ROLE_IN_USE',
        { roles: activeRoles }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.account.update({
        where: { id },
        data: { active: false, deactivatedAt: new Date(), deactivatedBy: auth.userId, updatedBy: auth.userId },
      })
      if (subtreeIds.length) {
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
      action: 'deactivate',
      oldValue: { active: true },
      newValue: { active: false, cascadedTo: subtreeIds.length },
      reason,
    })

    return ok({ success: true, deactivated: true, mode: 'deactivate', cascadedTo: subtreeIds.length })
  } catch (e: any) {
    return serverError(e.message)
  }
}
