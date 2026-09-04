import { db } from '@/lib/db'
import { ok, badRequest, notFound, serverError } from '@/lib/erp/api-response'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currency = await db.currency.findUnique({
      where: { id },
    })

    if (!currency) {
      return notFound('العملة غير موجودة')
    }

    if (currency.isBase) {
      return badRequest('لا يمكن توقيف العملة الأساسية للنظام.')
    }

    const isCurrentlySuspended = currency.status === 'suspended'
    const newStatus = isCurrentlySuspended ? 'active' : 'suspended'

    const updated = await db.currency.update({
      where: { id },
      data: {
        status: newStatus,
        active: newStatus === 'active',
        suspensionCount: !isCurrentlySuspended
          ? currency.suspensionCount + 1
          : currency.suspensionCount,
        suspendedAt: !isCurrentlySuspended ? new Date() : null,
      },
    })

    return ok({
      currency: updated,
      message: isCurrentlySuspended ? 'تم إعادة تنشيط العملة بنجاح' : 'تم توقيف العملة بنجاح',
    })
  } catch (e: any) {
    console.error('POST /api/erp/currencies/[id]/toggle-status Error:', e)
    return serverError(e.message)
  }
}
