import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

// GET /api/erp/branches/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, nameAr: true } },
        warehouses: true,
        _count: { select: { users: true, warehouses: true } },
      },
    })
    if (!branch) return notFound('الفرع غير موجود')
    return ok({
      ...branch,
      name: branch.nameAr,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT /api/erp/branches/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) return notFound('الفرع غير موجود')

    const nameAr = (body.nameAr || body.name || existing.nameAr).trim()
    const nameEn = (body.nameEn || nameAr).trim()
    const isMain = body.isMain !== undefined ? Boolean(body.isMain) : existing.isMain
    const active = body.active !== undefined ? Boolean(body.active) : existing.active

    // If setting as main, reset other main branches
    if (isMain && !existing.isMain) {
      await db.branch.updateMany({
        where: { companyId: existing.companyId },
        data: { isMain: false },
      })
    }

    const updated = await db.branch.update({
      where: { id },
      data: {
        nameAr,
        nameEn,
        address: body.address !== undefined ? body.address : existing.address,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        email: body.email !== undefined ? body.email : existing.email,
        isMain,
        active,
      },
      include: {
        company: { select: { id: true, nameAr: true } },
        _count: { select: { users: true, warehouses: true } },
      },
    })

    return ok({
      ...updated,
      name: updated.nameAr,
    })
  } catch (e: any) {
    return serverError(e.message || 'حدث خطأ أثناء تعديل بيانات الفرع')
  }
}

// DELETE /api/erp/branches/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.branch.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, warehouses: true } },
      },
    })
    if (!existing) return notFound('الفرع غير موجود')

    if (existing.isMain) {
      return badRequest('لا يمكن حذف الفرع الرئيسي للنظام')
    }

    if ((existing._count?.users ?? 0) > 0 || (existing._count?.warehouses ?? 0) > 0) {
      return badRequest('لا يمكن حذف الفرع لوجود مستخدمين أو مستودعات مرتبطة به')
    }

    await db.branch.delete({ where: { id } })
    return ok({ success: true, message: 'تم حذف الفرع بنجاح' })
  } catch (e: any) {
    return serverError(e.message || 'فشل حذف الفرع')
  }
}
