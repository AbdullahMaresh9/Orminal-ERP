import { db } from '@/lib/db'
import {
  ok, badRequest, notFound, serverError, forbidden,
} from '@/lib/erp/api-response'

// Module definitions used to auto-provision Permission rows when an admin
// first configures a role's permission matrix. Permission has no @@unique
// constraint on (moduleCode, actionCode), so we use findFirst + create.
const MODULE_DEFS: Record<string, { nameAr: string; nameEn: string }> = {
  FIN: { nameAr: 'مالية', nameEn: 'Finance' },
  SAL: { nameAr: 'مبيعات', nameEn: 'Sales' },
  PUR: { nameAr: 'مشتريات', nameEn: 'Procurement' },
  INV: { nameAr: 'مخزون', nameEn: 'Inventory' },
  MFG: { nameAr: 'تصنيع', nameEn: 'Manufacturing' },
  HR: { nameAr: 'موارد بشرية', nameEn: 'Human Resources' },
}

async function getOrCreateModulePermission(moduleCode: string) {
  const def = MODULE_DEFS[moduleCode]
  if (!def) return null
  const actionCode = `${moduleCode}_ACCESS`
  const existing = await db.permission.findFirst({ where: { moduleCode, actionCode } })
  if (existing) return existing
  return db.permission.create({
    data: {
      moduleCode,
      actionCode,
      nameAr: `وصول ${def.nameAr}`,
      nameEn: `${def.nameEn} Access`,
      riskLevel: 'low',
      active: true,
    },
  })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const role = await db.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    })
    if (!role) return notFound('الدور غير موجود')
    return ok(role)
  } catch (e: any) {
    return serverError(e.message)
  }
}

interface PermissionPayload {
  moduleCode: string
  canCreate?: boolean
  canRead?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canApprove?: boolean
  canPost?: boolean
  canCancel?: boolean
  canReverse?: boolean
  canExport?: boolean
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const role = await db.role.findUnique({ where: { id } })
    if (!role) return notFound('الدور غير موجود')

    // Update role fields (code is immutable; isSystem cannot be unset)
    const data: any = {}
    if (body.nameAr !== undefined) data.nameAr = body.nameAr
    if (body.nameEn !== undefined) data.nameEn = body.nameEn
    if (body.description !== undefined) data.description = body.description
    if (body.active !== undefined && !role.isSystem) data.active = body.active

    if (Object.keys(data).length > 0) {
      await db.role.update({ where: { id }, data })
    }

    // Update permission matrix
    if (Array.isArray(body.permissions)) {
      // Replace existing RolePermission records atomically
      await db.rolePermission.deleteMany({ where: { roleId: id } })
      for (const p of body.permissions as PermissionPayload[]) {
        const perm = await getOrCreateModulePermission(p.moduleCode)
        if (!perm) continue
        await db.rolePermission.create({
          data: {
            roleId: id,
            permissionId: perm.id,
            canCreate: p.canCreate ?? false,
            canRead: p.canRead ?? true,
            canUpdate: p.canUpdate ?? false,
            canDelete: p.canDelete ?? false,
            canApprove: p.canApprove ?? false,
            canPost: p.canPost ?? false,
            canCancel: p.canCancel ?? false,
            canReverse: p.canReverse ?? false,
            canExport: p.canExport ?? false,
          },
        })
      }
    }

    const updated = await db.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const role = await db.role.findUnique({ where: { id } })
    if (!role) return notFound('الدور غير موجود')
    if (role.isSystem) {
      return forbidden('لا يمكن حذف دور نظام — الدور محمي', 'SYSTEM_ROLE')
    }
    const userCount = await db.userRole.count({ where: { roleId: id, active: true } })
    if (userCount > 0) {
      return badRequest(
        `لا يمكن حذف الدور لأنه مرتبط بـ ${userCount} مستخدم نشط`,
        'ROLE_IN_USE',
        { userCount }
      )
    }
    await db.rolePermission.deleteMany({ where: { roleId: id } })
    await db.role.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
