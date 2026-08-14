import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError, unauthorized } from '@/lib/erp/api-response'
import { getRequestContext } from '@/lib/erp/context'

// Non-stock-affecting workflow transitions only. Posting stock (status 'done') MUST
// go through PUT /api/erp/deliveries/[id], which decrements stock and posts COGS atomically.
const ALLOWED_STATUSES = ['draft', 'waiting', 'picked', 'packed', 'approved', 'cancelled']

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json()

    const exists = await db.delivery.findFirst({ where: { id, companyId: context.companyId } })
    if (!exists) return notFound('الطلب غير موجود')
    if (exists.status === 'done' || exists.status === 'cancelled') {
      return badRequest('لا يمكن تعديل طلب مُنفّذ أو ملغى')
    }

    const nextStatus = body.status || 'approved'
    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      return badRequest('حالة غير مسموحة هنا؛ لترحيل المخزون استخدم شاشة التسليمات')
    }

    const updated = await db.delivery.update({
      where: { id },
      data: { status: nextStatus },
    })

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
