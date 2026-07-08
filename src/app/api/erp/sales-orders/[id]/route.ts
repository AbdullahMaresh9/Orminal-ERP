import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesOrder.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Sales order not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesOrder.findUnique({ where: { id } })
    if (!exists) return notFound('Sales order not found')
    if (exists.status === 'posted' || exists.status === 'paid') {
      return badRequest('Cannot edit posted/paid order')
    }

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.salesOrder.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesOrder.findUnique({ where: { id } })
    if (!exists) return notFound('Sales order not found')
    if (exists.status === 'posted' || exists.status === 'paid') {
      return badRequest('Cannot delete posted/paid order')
    }
    await db.salesOrderLine.deleteMany({ where: { orderId: id } })
    await db.salesOrder.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
