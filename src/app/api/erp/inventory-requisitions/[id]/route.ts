import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const exists = await db.delivery.findUnique({ where: { id }, include: { lines: true } })
    if (!exists) return notFound('الطلب غير موجود')

    const updated = await db.delivery.update({
      where: { id },
      data: { status: body.status || 'approved' },
    })

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
