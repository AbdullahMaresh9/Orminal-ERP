// GET /api/erp/accounts/:id/audit — immutable audit history for an account.
// Read-only by design: there is no write path for audit rows.

import { db } from '@/lib/db'
import { list, serverError, parsePagination } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canRead')
  if (isAuthFailure(auth)) return auth

  try {
    const { id } = await params
    const { page, pageSize, skip } = parsePagination(req)
    const where = { moduleCode: 'FIN', documentType: 'account', documentId: id }

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          oldValue: true,
          newValue: true,
          reason: true,
          createdAt: true,
          user: { select: { id: true, username: true, nameAr: true, nameEn: true } },
        },
      }),
      db.auditLog.count({ where }),
    ])

    const data = rows.map((r) => ({
      ...r,
      oldValue: r.oldValue ? safeParse(r.oldValue) : null,
      newValue: r.newValue ? safeParse(r.newValue) : null,
    }))

    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

function safeParse(v: string): unknown {
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}
