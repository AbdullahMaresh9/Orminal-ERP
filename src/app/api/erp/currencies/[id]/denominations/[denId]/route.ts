import { db } from '@/lib/db'
import { ok, badRequest, notFound, serverError } from '@/lib/erp/api-response'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; denId: string }> }
) {
  try {
    const { id, denId } = await params
    const body = await req.json()

    const existing = await db.currencyDenomination.findFirst({
      where: { id: denId, currencyId: id },
    })

    if (!existing) {
      return notFound('فئة العملة غير موجودة')
    }

    const { code, nameAr, nameEn, value, sortOrder, isSuspended } = body

    const updated = await db.currencyDenomination.update({
      where: { id: denId },
      data: {
        code: code ? code.trim().toUpperCase() : existing.code,
        nameAr: nameAr !== undefined ? nameAr.trim() : existing.nameAr,
        nameEn: nameEn !== undefined ? (nameEn ? nameEn.trim() : null) : existing.nameEn,
        value: value !== undefined ? Number(value) : existing.value,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
        isSuspended: isSuspended !== undefined ? Boolean(isSuspended) : existing.isSuspended,
      },
    })

    return ok(updated)
  } catch (e: any) {
    console.error('PUT /api/erp/currencies/[id]/denominations/[denId] Error:', e)
    return serverError(e.message)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; denId: string }> }
) {
  try {
    const { id, denId } = await params

    const existing = await db.currencyDenomination.findFirst({
      where: { id: denId, currencyId: id },
    })

    if (!existing) {
      return notFound('فئة العملة المراد حذفها غير موجودة')
    }

    await db.currencyDenomination.delete({
      where: { id: denId },
    })

    return ok({ message: 'تم حذف فئة العملة بنجاح' })
  } catch (e: any) {
    console.error('DELETE /api/erp/currencies/[id]/denominations/[denId] Error:', e)
    return serverError(e.message)
  }
}
