// =============================================================================
// System Configuration — RBAC
//
// Same hybrid policy as rbac.ts / ADR-CoA-005:
//   1. superuser roles are always allowed
//   2. DB catalog (Permission moduleCode 'CFG') is authoritative when seeded
//   3. otherwise the documented default matrix below decides
//
// Actions:
//   CONFIG        — read/write ordinary settings
//   CONFIG_SYSTEM — settings flagged isSystem (posting, periods, tax, …)
//   CONFIG_SECRET — secret credentials (SMTP password, ZATCA keys, …)
//   CONFIG_AUDIT  — read the configuration audit log
// =============================================================================

import { db } from '@/lib/db'
import { forbidden } from '@/lib/erp/api-response'
import { requireAuth, isAuthFailure, type AuthContext } from '@/lib/erp/rbac'
import type { NextResponse } from 'next/server'

export type ConfigAction = 'CONFIG' | 'CONFIG_SYSTEM' | 'CONFIG_SECRET' | 'CONFIG_AUDIT'
export type ConfigCapability = 'canRead' | 'canUpdate' | 'canDelete' | 'canExport'

export const CONFIG_PERMISSION_CATALOG: {
  actionCode: ConfigAction
  nameAr: string
  nameEn: string
  riskLevel: 'medium' | 'high' | 'critical'
}[] = [
  { actionCode: 'CONFIG', nameAr: 'إعدادات النظام', nameEn: 'System configuration', riskLevel: 'high' },
  { actionCode: 'CONFIG_SYSTEM', nameAr: 'إعدادات النظام الحساسة', nameEn: 'Critical system configuration', riskLevel: 'critical' },
  { actionCode: 'CONFIG_SECRET', nameAr: 'بيانات الاعتماد والتكاملات', nameEn: 'Credentials & integrations', riskLevel: 'critical' },
  { actionCode: 'CONFIG_AUDIT', nameAr: 'سجل تدقيق الإعدادات', nameEn: 'Configuration audit log', riskLevel: 'medium' },
]

const SUPERUSERS = ['ADMIN', 'SUPERADMIN', 'SYSTEM', 'OWNER']

/** Documented fallback when the Permission catalog has no CFG rows yet. */
const DEFAULT_MATRIX: Record<string, Partial<Record<ConfigAction, ConfigCapability[]>>> = {
  ACCOUNTANT: { CONFIG: ['canRead'], CONFIG_AUDIT: ['canRead'] },
  MANAGER: { CONFIG: ['canRead'], CONFIG_AUDIT: ['canRead'] },
  VIEWER: {},
  SALES: {},
}

function matrixAllows(roleCode: string, action: ConfigAction, cap: ConfigCapability): boolean {
  return Boolean(DEFAULT_MATRIX[roleCode]?.[action]?.includes(cap))
}

export async function checkConfigCapability(
  ctx: AuthContext,
  action: ConfigAction,
  capability: ConfigCapability
): Promise<{ allowed: boolean; source: 'db' | 'default_matrix' }> {
  const role = (ctx.roleCode ?? '').toUpperCase()
  if (SUPERUSERS.includes(role)) return { allowed: true, source: 'default_matrix' }

  const permission = await db.permission.findFirst({
    where: { moduleCode: 'CFG', actionCode: action, active: true },
    select: { id: true },
  })
  if (!permission) {
    return { allowed: matrixAllows(role, action, capability), source: 'default_matrix' }
  }
  const grants = await db.rolePermission.findMany({
    where: {
      permissionId: permission.id,
      role: { active: true, userRoles: { some: { userId: ctx.userId, active: true } } },
    },
    select: { canRead: true, canUpdate: true, canDelete: true, canExport: true },
  })
  if (!grants.length) {
    return { allowed: matrixAllows(role, action, capability), source: 'default_matrix' }
  }
  const allowed = grants.some((g) => Boolean((g as Record<string, boolean>)[capability]))
  return { allowed, source: 'db' }
}

/** Auth + capability guard for configuration routes. */
export async function requireConfigCapability(
  action: ConfigAction,
  capability: ConfigCapability
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth()
  if (isAuthFailure(ctx)) return ctx
  const { allowed } = await checkConfigCapability(ctx, action, capability)
  if (!allowed) {
    return forbidden(
      `صلاحية غير كافية: إدارة الإعدادات تتطلب ${capability} على ${action}`,
      'INSUFFICIENT_PERMISSION'
    )
  }
  return ctx
}

/** Seed CFG permission rows + grant to ADMIN role. Idempotent. */
export async function seedConfigPermissions(): Promise<number> {
  let createdCount = 0
  for (const p of CONFIG_PERMISSION_CATALOG) {
    const existing = await db.permission.findFirst({
      where: { moduleCode: 'CFG', actionCode: p.actionCode },
      select: { id: true },
    })
    if (existing) continue
    const perm = await db.permission.create({
      data: {
        moduleCode: 'CFG',
        actionCode: p.actionCode,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        riskLevel: p.riskLevel,
        requiresAudit: true,
      },
    })
    createdCount++
    const adminRoles = await db.role.findMany({
      where: { code: { in: ['ADMIN', 'SUPERADMIN', 'OWNER'] }, active: true },
      select: { id: true },
    })
    for (const r of adminRoles) {
      await db.rolePermission.create({
        data: {
          roleId: r.id,
          permissionId: perm.id,
          canRead: true,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
          canExport: true,
        },
      })
    }
  }
  return createdCount
}
