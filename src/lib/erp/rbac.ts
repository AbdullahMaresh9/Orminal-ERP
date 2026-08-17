// Enterprise ERP — Server-side RBAC guard
//
// Every mutating/reading API route must call one of the require* helpers.
// Enforcement is SERVER-SIDE ONLY; the UI merely hides what the server forbids.
//
// Resolution order for a capability:
//   1. DB: UserRole -> Role -> RolePermission -> Permission(moduleCode, actionCode)
//   2. If the RBAC catalog has no Permission row for that action yet (fresh
//      install — the seeds create roles but not permission rows), fall back to
//      DEFAULT_ROLE_MATRIX below. This is deliberate: failing closed would lock
//      every user out of a system whose permission catalog was never populated,
//      and failing open would be a security hole. The matrix is the documented
//      default policy, and `scripts/migrate-chart-of-accounts.mjs` provisions the
//      real Permission/RolePermission rows so the DB becomes authoritative.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { db } from '@/lib/db'
import { forbidden, unauthorized } from './api-response'
import type { NextResponse } from 'next/server'

export type { Capability, CoaAction } from './coa-policy'
export { COA_ACTIONS, DEFAULT_ROLE_MATRIX, FALLBACK_POLICY, matrixAllows } from './coa-policy'

import { COA_ACTIONS as ACTIONS, matrixAllows as policyAllows, type Capability as Cap, type CoaAction as Action } from './coa-policy'

export interface AuthContext {
  userId: string
  username: string
  roleCode: string
  companyId: string | null
  branchId: string | null
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) return null
  return {
    userId: user.id,
    username: user.username ?? '',
    roleCode: (user.roleCode ?? 'VIEWER').toUpperCase(),
    companyId: user.defaultCompanyId ?? null,
    branchId: user.defaultBranchId ?? null,
  }
}

/** 401 when there is no valid session. */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized('يجب تسجيل الدخول للوصول إلى هذه البيانات')
  return ctx
}

export function isAuthFailure(v: AuthContext | NextResponse): v is NextResponse {
  return !(v as AuthContext).userId
}

/**
 * Check a capability for the current user.
 * Returns { allowed, source } so callers/tests can see which policy decided.
 */
export async function checkCapability(
  ctx: AuthContext,
  action: Action,
  capability: Cap
): Promise<{ allowed: boolean; source: 'db' | 'default_matrix' }> {
  // Does the RBAC catalog know this action at all?
  const permission = await db.permission.findFirst({
    where: { moduleCode: 'FIN', actionCode: action, active: true },
    select: { id: true },
  })

  if (!permission) {
    return { allowed: policyAllows(ctx.roleCode, action, capability), source: 'default_matrix' }
  }

  const grants = await db.rolePermission.findMany({
    where: {
      permissionId: permission.id,
      role: { active: true, userRoles: { some: { userId: ctx.userId, active: true } } },
    },
    select: {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canApprove: true,
      canPost: true,
      canExport: true,
      canImport: true,
      canPrint: true,
    },
  })

  // Union of the user's role grants (most permissive wins across roles).
  const allowed = grants.some((g) => Boolean((g as Record<string, boolean>)[capability as string]))
  return { allowed, source: 'db' }
}

/** Combined auth + permission guard. Returns AuthContext or a 401/403 response. */
export async function requireCapability(
  action: Action,
  capability: Cap
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth()
  if (isAuthFailure(ctx)) return ctx
  const { allowed } = await checkCapability(ctx, action, capability)
  if (!allowed) {
    return forbidden(`صلاحية غير كافية: العملية تتطلب ${capability} على ${action}`, 'INSUFFICIENT_PERMISSION')
  }
  return ctx
}
