// Enterprise ERP — Chart of Accounts write operations
// Shared by POST /accounts and POST /accounts/:id/children so the creation rules
// exist in exactly one place.

import { db } from '@/lib/db'
import { auditAccount } from './audit'
import {
  buildPath,
  deriveAccountFields,
  levelFromPath,
  validateAccountInput,
  type AccountInput,
  type FieldError,
} from './account-service'
import { classFromLegacyType, isAccountClass, type AccountClass } from './account-classes'
import { SCOPE_ANY } from './account-determination'
import { isValidRole } from './account-roles'

export interface CreateAccountAuth {
  userId: string
  companyId: string | null
}

export type CreateAccountResult =
  | { kind: 'created'; account: Awaited<ReturnType<typeof db.account.update>> }
  | { kind: 'invalid'; errors: FieldError[] }
  | { kind: 'conflict'; message: string; code: string }

export async function createAccount(
  input: AccountInput & { reason?: string; type?: string },
  auth: CreateAccountAuth
): Promise<CreateAccountResult> {
  const body = { ...input }

  // Accept the legacy `type` vocabulary but always store a class.
  if (!body.accountClass && body.type) {
    body.accountClass = classFromLegacyType(body.type, body.subtype ?? null)
  }

  const parent = body.parentId
    ? await db.account.findUnique({
        where: { id: body.parentId },
        select: {
          id: true, code: true, nameAr: true, parentId: true, isPosting: true,
          accountClass: true, normalBalance: true, active: true, isSystem: true, path: true,
        },
      })
    : null

  const errors = validateAccountInput(body, { isCreate: true, parent })
  if (errors.length) return { kind: 'invalid', errors }

  const code = (body.code ?? '').trim()
  const dup = await db.account.findUnique({ where: { code } })
  if (dup) return { kind: 'conflict', message: `رمز الحساب "${code}" مستخدم بالفعل`, code: 'DUPLICATE_CODE' }

  const accountClass = body.accountClass as AccountClass
  if (!isAccountClass(accountClass)) {
    return { kind: 'invalid', errors: [{ field: 'accountClass', code: 'INVALID', message: 'فئة الحساب غير معروفة' }] }
  }

  const derived = deriveAccountFields({
    accountClass,
    normalBalance: body.normalBalance,
    fsSection: body.fsSection,
    isPosting: body.isPosting,
  })

  const account = await db.$transaction(async (tx) => {
    const createdAccount = await tx.account.create({
      data: {
        code,
        nameAr: (body.nameAr ?? '').trim(),
        nameEn: body.nameEn?.trim() || null,
        shortName: body.shortName?.trim() || null,
        accountClass,
        type: derived.type,
        subtype: body.subtype || null,
        parentId: body.parentId || null,
        isPosting: body.isPosting ?? true,
        isSystem: false,
        normalBalance: derived.normalBalance,
        currencyId: body.currencyId || null,
        allowReconciliation: body.allowReconciliation ?? false,
        allowManualEntry: body.allowManualEntry ?? true,
        taxBehavior: body.taxBehavior ?? 'none',
        taxCodeId: body.taxCodeId || null,
        fsSection: derived.fsSection,
        reportCategory: body.reportCategory || null,
        reportSubcategory: body.reportSubcategory || null,
        reportTags: Array.isArray(body.reportTags) ? JSON.stringify(body.reportTags) : body.reportTags || null,
        requireCostCenter: body.requireCostCenter ?? false,
        requireBranch: body.requireBranch ?? false,
        requireProject: body.requireProject ?? false,
        active: body.active ?? true,
        createdBy: auth.userId,
        updatedBy: auth.userId,
        level: 0,
        path: null,
      },
    })

    const path = buildPath(parent?.path ?? null, createdAccount.id)
    const updated = await tx.account.update({
      where: { id: createdAccount.id },
      data: { path, level: levelFromPath(path) },
    })

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
          accountId: createdAccount.id,
          createdBy: auth.userId,
          updatedBy: auth.userId,
        },
        update: { accountId: createdAccount.id, active: true, updatedBy: auth.userId },
      })
    }

    return updated
  })

  await auditAccount({
    userId: auth.userId,
    companyId: auth.companyId,
    accountId: account.id,
    action: 'create',
    newValue: {
      code: account.code,
      nameAr: account.nameAr,
      accountClass: account.accountClass,
      isPosting: account.isPosting,
      parentId: account.parentId,
      role: body.role ?? null,
    },
    reason: body.reason ?? null,
  })

  return { kind: 'created', account }
}
