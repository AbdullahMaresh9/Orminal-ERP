// GET /api/erp/accounts/stats — KPI header for the Chart of Accounts screen.
// Class totals are computed from journal lines, respecting each account's
// normal balance, and only POSTING accounts are summed (group accounts would
// double-count their children).

import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { fetchAccountBalances } from '@/lib/erp/account-service'
import { ACCOUNT_CLASS_CODES, signedBalance } from '@/lib/erp/account-classes'
import { ACCOUNT_ROLES } from '@/lib/erp/account-roles'

export async function GET() {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const accounts = await db.account.findMany({
      select: { id: true, accountClass: true, isPosting: true, isSystem: true, active: true, normalBalance: true },
    })
    const balances = await fetchAccountBalances()

    const byClass: Record<string, { count: number; balance: number }> = {}
    for (const c of ACCOUNT_CLASS_CODES) byClass[c] = { count: 0, balance: 0 }

    let posting = 0
    let group = 0
    let active = 0
    let system = 0
    let inactive = 0

    for (const a of accounts) {
      if (a.isPosting) posting++
      else group++
      if (a.active) active++
      else inactive++
      if (a.isSystem) system++

      const bucket = byClass[a.accountClass] ?? (byClass[a.accountClass] = { count: 0, balance: 0 })
      bucket.count++
      if (a.isPosting) {
        const b = balances.get(a.id)
        if (b) bucket.balance += signedBalance(a.normalBalance, b.debit, b.credit)
      }
    }

    for (const k of Object.keys(byClass)) byClass[k].balance = Math.round(byClass[k].balance * 100) / 100

    // Determination coverage — how many required roles are actually mapped.
    const mapped = await db.accountRoleMapping.findMany({ where: { active: true }, select: { role: true } })
    const mappedRoles = new Set(mapped.map((m) => m.role))
    const requiredRoleCodes = ACCOUNT_ROLES.filter((r) => r.required).map((r) => r.code)
    const missingRequiredRoles = requiredRoleCodes.filter((r) => !mappedRoles.has(r))

    const totalAssets = byClass.asset?.balance ?? 0
    const totalLiabilities = byClass.liability?.balance ?? 0
    const totalEquity = byClass.equity?.balance ?? 0

    return ok({
      totals: {
        accounts: accounts.length,
        postingAccounts: posting,
        groupAccounts: group,
        activeAccounts: active,
        inactiveAccounts: inactive,
        systemAccounts: system,
      },
      byClass,
      financial: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        // Assets = Liabilities + Equity. A non-zero delta means unbalanced data.
        accountingEquationDelta: Math.round((totalAssets - (totalLiabilities + totalEquity)) * 100) / 100,
      },
      determination: {
        mappedRoles: mappedRoles.size,
        totalRoles: ACCOUNT_ROLES.length,
        missingRequiredRoles,
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
