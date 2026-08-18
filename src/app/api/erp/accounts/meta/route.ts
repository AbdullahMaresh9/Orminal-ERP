// GET /api/erp/accounts/meta — form metadata: classes, subtypes, roles, currencies,
// tax codes. Lets the UI render conditional fields without hardcoding vocabulary.

import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { ACCOUNT_CLASSES, ACCOUNT_CLASS_CODES } from '@/lib/erp/account-classes'
import { ACCOUNT_ROLES } from '@/lib/erp/account-roles'
import { VALID_FS_SECTION, VALID_NORMAL_BALANCE, VALID_TAX_BEHAVIOR } from '@/lib/erp/account-service'

export async function GET() {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const [currencies, taxCodes] = await Promise.all([
      db.currency.findMany({ where: { active: true }, select: { id: true, code: true, nameAr: true, nameEn: true, symbol: true }, orderBy: { code: 'asc' } }),
      db.taxCode.findMany({ where: { active: true }, select: { id: true, code: true, nameAr: true, nameEn: true, rate: true }, orderBy: { code: 'asc' } }),
    ])

    return ok({
      classes: ACCOUNT_CLASS_CODES.map((c) => {
        const def = ACCOUNT_CLASSES[c]
        return {
          code: def.code,
          nameAr: def.nameAr,
          nameEn: def.nameEn,
          type: def.type,
          normalBalance: def.normalBalance,
          fsSection: def.fsSection,
          codePrefix: def.codePrefix,
          subtypes: def.subtypes,
        }
      }),
      roles: ACCOUNT_ROLES.map((r) => ({
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        group: r.group,
        required: r.required,
        allowedClasses: r.allowedClasses,
        descriptionAr: r.descriptionAr,
      })),
      normalBalances: VALID_NORMAL_BALANCE,
      taxBehaviors: VALID_TAX_BEHAVIOR,
      fsSections: VALID_FS_SECTION,
      currencies,
      taxCodes,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
