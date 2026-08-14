// Enterprise ERP — Request Context Helper
// Resolves the authenticated user and their active company/branch scope.
// Backward compatible: if the user has no default company set, falls back to
// the first company in the database (single-company deployments).

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

export interface RequestContext {
  userId: string
  companyId: string
  branchId?: string
}

/**
 * Returns the authenticated request context, or null when the request is
 * unauthenticated. Company scope prefers the user's default company and falls
 * back to the first company for legacy single-company setups.
 */
export async function getRequestContext(): Promise<RequestContext | null> {
  const session = await getServerSession(authOptions)
  const user = session?.user as
    | { id?: string; defaultCompanyId?: string | null; defaultBranchId?: string | null }
    | undefined

  if (!user?.id) return null

  let companyId = user.defaultCompanyId ?? undefined
  let branchId = user.defaultBranchId ?? undefined

  if (!companyId) {
    const company = await db.company.findFirst({ select: { id: true } })
    if (!company) return null
    companyId = company.id
  }

  if (!branchId) {
    const branch = await db.branch.findFirst({ where: { companyId }, select: { id: true } })
    branchId = branch?.id
  }

  return { userId: user.id, companyId, branchId }
}
