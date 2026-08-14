import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Purchase order not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.purchaseOrder.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase order not found')
    // Once a PO has been received/billed/paid it is locked against edits.
    if (['received', 'billed', 'paid'].includes(exists.status)) {
      return badRequest('Cannot edit an order that has been received, billed, or paid')
    }

    // Whitelist safe editable fields only — never let totals or scope be overwritten here.
    const { notes, expectedDate, paymentTermId, currencyId, warehouseId, incoterms, status } = body
    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        notes,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        paymentTermId,
        currencyId,
        warehouseId,
        incoterms,
        // Only allow moving between draft/confirmed/cancelled here
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
    const exists = await db.purchaseOrder.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase order not found')
    if (exists.status === 'received' || exists.status === 'paid') {
      return badRequest('Cannot delete received/paid order')
    }
    await db.purchaseOrderLine.deleteMany({ where: { orderId: id } })
    await db.purchaseOrder.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
