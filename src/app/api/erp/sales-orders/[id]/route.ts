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
    if (['delivered', 'posted', 'paid'].includes(exists.status)) {
      return badRequest('Cannot edit an order that has been delivered, posted, or paid')
    }

    // Whitelist safe editable fields only — never let totals or scope be overwritten here.
    const { notes, requiredDate, paymentTermId, currencyId, warehouseId, salespersonId, priceListId, status } = body
    const updated = await db.salesOrder.update({
      where: { id },
      data: {
        notes,
        requiredDate: requiredDate ? new Date(requiredDate) : undefined,
        paymentTermId,
        currencyId,
        warehouseId,
        salespersonId,
        priceListId,
        status: ['draft', 'confirmed', 'cancelled'].includes(status) ? status : undefined,
      },
    })
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
