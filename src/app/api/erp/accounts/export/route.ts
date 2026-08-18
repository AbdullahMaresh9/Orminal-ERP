// GET /api/erp/accounts/export?format=csv|json — export the chart of accounts.
// CSV is UTF-8 with BOM so Excel renders Arabic correctly.

import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { writeAudit } from '@/lib/erp/audit'
import { fetchAccountBalances } from '@/lib/erp/account-service'
import { signedBalance } from '@/lib/erp/account-classes'

const HEADERS = [
  'code', 'nameAr', 'nameEn', 'shortName', 'accountClass', 'type', 'subtype',
  'parentCode', 'kind', 'normalBalance', 'currency', 'taxBehavior', 'fsSection',
  'reportCategory', 'allowReconciliation', 'requireCostCenter', 'requireBranch',
  'requireProject', 'roles', 'isSystem', 'active', 'debit', 'credit', 'balance',
]

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canExport')
  if (isAuthFailure(auth)) return auth

  try {
    const url = new URL(req.url)
    const format = (url.searchParams.get('format') ?? 'csv').toLowerCase()

    const accounts = await db.account.findMany({
      orderBy: { code: 'asc' },
      include: {
        parent: { select: { code: true } },
        currency: { select: { code: true } },
        roleMappings: { where: { active: true }, select: { role: true } },
      },
    })
    const balances = await fetchAccountBalances()

    const rows = accounts.map((a) => {
      const b = balances.get(a.id) ?? { debit: 0, credit: 0 }
      return {
        code: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn ?? '',
        shortName: a.shortName ?? '',
        accountClass: a.accountClass,
        type: a.type,
        subtype: a.subtype ?? '',
        parentCode: a.parent?.code ?? '',
        kind: a.isPosting ? 'posting' : 'group',
        normalBalance: a.normalBalance,
        currency: a.currency?.code ?? '',
        taxBehavior: a.taxBehavior,
        fsSection: a.fsSection,
        reportCategory: a.reportCategory ?? '',
        allowReconciliation: a.allowReconciliation,
        requireCostCenter: a.requireCostCenter,
        requireBranch: a.requireBranch,
        requireProject: a.requireProject,
        roles: a.roleMappings.map((m) => m.role).join('|'),
        isSystem: a.isSystem,
        active: a.active,
        debit: b.debit,
        credit: b.credit,
        balance: signedBalance(a.normalBalance, b.debit, b.credit),
      }
    })

    await writeAudit({
      userId: auth.userId,
      companyId: auth.companyId,
      moduleCode: 'FIN',
      documentType: 'account',
      action: 'export',
      newValue: { format, count: rows.length },
    })

    if (format === 'json') return ok({ accounts: rows, count: rows.length })

    const csv = [HEADERS.join(','), ...rows.map((r) => HEADERS.map((h) => csvCell((r as Record<string, unknown>)[h])).join(','))].join('\n')
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
