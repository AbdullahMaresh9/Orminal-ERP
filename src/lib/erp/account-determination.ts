// Enterprise ERP — Account Determination resolver
// ADR-CoA-001. Resolves a semantic AccountRole -> concrete GL account.
//
// Scope precedence (most specific wins):
//   (companyId, branchId) > (companyId, '*') > ('*', '*')
//
// Guarantees enforced here (so every posting site inherits them for free):
//   - the resolved account exists
//   - it is a POSTING account (never a group account)
//   - it is ACTIVE
// Any violation throws a descriptive error instead of writing a bad journal line.

import { db } from '@/lib/db'
import { getRoleDef, type AccountRole } from './account-roles'

export const SCOPE_ANY = '*'

export interface DeterminationScope {
  companyId?: string | null
  branchId?: string | null
}

export interface ResolvedAccount {
  id: string
  code: string
  nameAr: string
  normalBalance: string
  accountClass: string
}

/**
 * Legacy fallback: the hardcoded codes this system used before account
 * determination existed. Used ONLY when a role has no mapping row yet, so an
 * un-migrated database keeps posting exactly as it did before.
 * Once `scripts/migrate-chart-of-accounts.mjs` has run, mappings exist and this
 * table is never consulted.
 */
export const LEGACY_ROLE_CODE_FALLBACK: Partial<Record<AccountRole, string>> = {
  CASH: '1000',
  BANK: '1020',
  CUSTOMER_RECEIVABLE: '1100',
  INVENTORY: '1200',
  RAW_MATERIALS: '1210',
  FINISHED_GOODS: '1220',
  WIP: '1230',
  TAX_RECEIVABLE: '1400',
  ASSET: '1500',
  ACCUMULATED_DEPRECIATION: '1590',
  SUPPLIER_PAYABLE: '2000',
  TAX_PAYABLE: '2100',
  SALARIES_PAYABLE: '2200',
  GRNI: '2300',
  RETAINED_EARNINGS: '3100',
  SALES: '4000',
  OTHER_REVENUE: '4100',
  SALES_RETURN: '4200',
  INVENTORY_GAIN: '4100',
  COGS: '5000',
  PURCHASE: '5100',
  PURCHASE_RETURN: '5100',
  PRODUCTION_COST: '5200',
  PAYROLL: '6000',
  DEPRECIATION: '6400',
  INVENTORY_LOSS: '6300',
  SALES_DISCOUNT: '6300',
  ROUNDING: '6300',
  PAYROLL_DEDUCTIONS_PAYABLE: '2200',
}

function scopeRank(companyId: string, branchId: string, scope: DeterminationScope): number {
  const c = scope.companyId ?? SCOPE_ANY
  const b = scope.branchId ?? SCOPE_ANY
  if (companyId === c && branchId === b && b !== SCOPE_ANY) return 3
  if (companyId === c && branchId === SCOPE_ANY) return 2
  if (companyId === SCOPE_ANY && branchId === SCOPE_ANY) return 1
  return 0
}

function assertPostable(role: string, acc: { code: string; isPosting: boolean; active: boolean; nameAr: string }): void {
  if (!acc.isPosting) {
    throw new Error(`ACCOUNT_ROLE_NOT_POSTING: الدور "${role}" مرتبط بحساب مجمّع (${acc.code} — ${acc.nameAr}). الترحيل يجب أن يكون على حساب ترحيل.`)
  }
  if (!acc.active) {
    throw new Error(`ACCOUNT_ROLE_INACTIVE: الدور "${role}" مرتبط بحساب غير نشط (${acc.code} — ${acc.nameAr}).`)
  }
}

/**
 * Resolve several roles in ONE query set (no N+1) and return a role -> account map.
 * Throws on the first role that cannot be resolved to a valid posting account.
 */
export async function resolveAccounts(
  roles: readonly AccountRole[],
  scope: DeterminationScope = {}
): Promise<Map<AccountRole, ResolvedAccount>> {
  const wanted = [...new Set(roles)]
  if (!wanted.length) return new Map()

  const company = scope.companyId ?? SCOPE_ANY
  const branch = scope.branchId ?? SCOPE_ANY

  const mappings = await db.accountRoleMapping.findMany({
    where: {
      role: { in: wanted as string[] },
      active: true,
      OR: [
        { companyId: company, branchId: branch },
        { companyId: company, branchId: SCOPE_ANY },
        { companyId: SCOPE_ANY, branchId: SCOPE_ANY },
      ],
    },
    include: {
      account: {
        select: { id: true, code: true, nameAr: true, isPosting: true, active: true, normalBalance: true, accountClass: true },
      },
    },
  })

  // Pick the highest-ranking scope per role.
  const best = new Map<string, { rank: number; acc: (typeof mappings)[number]['account'] }>()
  for (const m of mappings) {
    const rank = scopeRank(m.companyId, m.branchId, { companyId: company, branchId: branch })
    if (rank === 0) continue
    const current = best.get(m.role)
    if (!current || rank > current.rank) best.set(m.role, { rank, acc: m.account })
  }

  const out = new Map<AccountRole, ResolvedAccount>()
  const unmapped: AccountRole[] = []

  for (const role of wanted) {
    const hit = best.get(role)
    if (hit) {
      assertPostable(role, hit.acc)
      out.set(role, {
        id: hit.acc.id,
        code: hit.acc.code,
        nameAr: hit.acc.nameAr,
        normalBalance: hit.acc.normalBalance,
        accountClass: hit.acc.accountClass,
      })
    } else {
      unmapped.push(role)
    }
  }

  // Legacy fallback by account code for roles with no mapping row.
  if (unmapped.length) {
    const codes = unmapped.map((r) => LEGACY_ROLE_CODE_FALLBACK[r]).filter((c): c is string => Boolean(c))
    const byCode = codes.length
      ? new Map(
          (
            await db.account.findMany({
              where: { code: { in: codes } },
              select: { id: true, code: true, nameAr: true, isPosting: true, active: true, normalBalance: true, accountClass: true },
            })
          ).map((a) => [a.code, a])
        )
      : new Map()

    for (const role of unmapped) {
      const fallbackCode = LEGACY_ROLE_CODE_FALLBACK[role]
      const acc = fallbackCode ? byCode.get(fallbackCode) : undefined
      if (!acc) {
        const def = getRoleDef(role)
        throw new Error(
          `ACCOUNT_ROLE_UNMAPPED: الدور "${role}"${def ? ` (${def.nameAr})` : ''} غير مرتبط بأي حساب. اضبط تحديد الحسابات من إعدادات دليل الحسابات.`
        )
      }
      assertPostable(role, acc)
      console.warn(`[account-determination] role ${role} has no mapping; using legacy code ${fallbackCode}`)
      out.set(role, {
        id: acc.id,
        code: acc.code,
        nameAr: acc.nameAr,
        normalBalance: acc.normalBalance,
        accountClass: acc.accountClass,
      })
    }
  }

  return out
}

/** Resolve a single role. */
export async function resolveAccount(role: AccountRole, scope: DeterminationScope = {}): Promise<ResolvedAccount> {
  const map = await resolveAccounts([role], scope)
  return map.get(role)!
}

/** Resolve a role to its account CODE (used by the posting templates). */
export async function resolveAccountCode(role: AccountRole, scope: DeterminationScope = {}): Promise<string> {
  return (await resolveAccount(role, scope)).code
}

/** Current mapping table for the settings UI (includes unmapped roles). */
export async function listRoleMappings(scope: DeterminationScope = {}) {
  const company = scope.companyId ?? SCOPE_ANY
  const branch = scope.branchId ?? SCOPE_ANY
  return db.accountRoleMapping.findMany({
    where: {
      OR: [
        { companyId: company, branchId: branch },
        { companyId: company, branchId: SCOPE_ANY },
        { companyId: SCOPE_ANY, branchId: SCOPE_ANY },
      ],
    },
    include: {
      account: { select: { id: true, code: true, nameAr: true, nameEn: true, isPosting: true, active: true, accountClass: true } },
    },
    orderBy: { role: 'asc' },
  })
}
