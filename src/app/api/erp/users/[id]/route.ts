import { db } from '@/lib/db'
import {
  ok, badRequest, notFound, serverError, forbidden,
} from '@/lib/erp/api-response'
import { hashPassword } from '@/lib/auth/password'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true,
        nameAr: true, nameEn: true,
        phone: true, avatar: true,
        active: true, mfaEnabled: true,
        defaultCompanyId: true, defaultBranchId: true,
        locale: true, timezone: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        defaultBranch: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        userRoles: {
          include: {
            role: {
              select: { id: true, code: true, nameAr: true, nameEn: true, isSystem: true },
            },
          },
        },
      },
    })
    if (!user) return notFound('المستخدم غير موجود')
    return ok(user)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return notFound('المستخدم غير موجود')

    // Duplicate email check if changing
    if (body.email && body.email !== existing.email) {
      const dup = await db.user.findFirst({ where: { email: body.email, NOT: { id } } })
      if (dup) return badRequest('البريد الإلكتروني مستخدم بالفعل', 'DUPLICATE_EMAIL')
    }

    const data: any = {}
    if (body.nameAr !== undefined) data.nameAr = body.nameAr
    if (body.nameEn !== undefined) data.nameEn = body.nameEn || null
    if (body.email !== undefined) data.email = body.email
    if (body.phone !== undefined) data.phone = body.phone || null
    if (body.avatar !== undefined) data.avatar = body.avatar || null
    if (body.defaultBranchId !== undefined) data.defaultBranchId = body.defaultBranchId || null
    if (body.active !== undefined) data.active = body.active
    if (body.mfaEnabled !== undefined) data.mfaEnabled = body.mfaEnabled
    if (body.locale !== undefined) data.locale = body.locale
    if (body.timezone !== undefined) data.timezone = body.timezone
    if (body.password) {
      data.passwordHash = await hashPassword(body.password)
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, username: true, email: true,
        nameAr: true, nameEn: true,
        active: true, mfaEnabled: true,
        locale: true, timezone: true,
        defaultBranchId: true, lastLoginAt: true,
        createdAt: true, updatedAt: true,
      },
    })

    // Update role assignment (replace all userRoles)
    if (body.roleId !== undefined) {
      await db.userRole.deleteMany({ where: { userId: id } })
      if (body.roleId) {
        const role = await db.role.findUnique({ where: { id: body.roleId } })
        if (role) {
          await db.userRole.create({ data: { userId: id, roleId: body.roleId } })
        }
      }
    }

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: { username: true, userRoles: { select: { roleId: true } } },
    })
    if (!user) return notFound('المستخدم غير موجود')
    if (user.username === 'admin') {
      return forbidden('لا يمكن حذف المستخدم الإداري الافتراضي', 'SYSTEM_USER')
    }
    // Detach role links; AuditLog.userId is nullable (SetNull on delete);
    // Notification cascades via onDelete: Cascade.
    await db.userRole.deleteMany({ where: { userId: id } })
    await db.user.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
