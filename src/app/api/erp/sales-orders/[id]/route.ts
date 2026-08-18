import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

// GET /api/erp/sales-orders/[id]
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

// PUT — update sales order details, status, or lines
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesOrder.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!exists) return notFound('Sales order not found')

    // Only allow full data edit if status is draft
    if (exists.status !== 'draft' && body.status === undefined) {
      return badRequest('يمكن فقط تعديل أوامر البيع التي في حالة مسودة / Only draft sales orders can be edited')
    }

    const dataToUpdate: any = {}

    if (body.partnerId !== undefined) dataToUpdate.partnerId = body.partnerId
    if (body.status !== undefined) dataToUpdate.status = body.status
    if (body.notes !== undefined) dataToUpdate.notes = body.notes
    if (body.orderDate !== undefined) {
      dataToUpdate.orderDate = body.orderDate ? new Date(body.orderDate) : new Date()
    }
    if (body.requiredDate !== undefined) {
      dataToUpdate.requiredDate = body.requiredDate ? new Date(body.requiredDate) : null
    }

    // If lines are provided in request body, calculate line totals and update lines atomically
    if (Array.isArray(body.lines)) {
      let subtotal = 0
      let taxTotal = 0
      const processedLines = body.lines.map((l: any) => {
        const lineSubtotal = (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discountPercent || 0) / 100) - (l.discountAmount || 0)
        const lineTax = lineSubtotal * ((l.taxRate || 0) / 100)
        const total = lineSubtotal + lineTax
        subtotal += lineSubtotal
        taxTotal += lineTax
        return {
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          uomId: l.uomId,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent ?? 0,
          discountAmount: l.discountAmount ?? 0,
          taxCodeId: l.taxCodeId,
          taxRate: l.taxRate ?? 0,
          total,
        }
      })
      const discount = body.discount !== undefined ? body.discount : (exists.discount ?? 0)
      const total = subtotal + taxTotal - discount

      dataToUpdate.subtotal = subtotal
      dataToUpdate.taxTotal = taxTotal
      dataToUpdate.discount = discount
      dataToUpdate.total = total

      const updated = await db.$transaction(async (tx) => {
        await tx.salesOrderLine.deleteMany({ where: { orderId: id } })
        return tx.salesOrder.update({
          where: { id },
          data: {
            ...dataToUpdate,
            lines: { create: processedLines },
          },
          include: {
            partner: true,
            lines: { include: { product: true } },
          },
        })
      })
      return ok(updated)
    }

    const updated = await db.salesOrder.update({
      where: { id },
      data: dataToUpdate,
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — delete sales order if draft or cancelled
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesOrder.findUnique({ where: { id } })
    if (!exists) return notFound('Sales order not found')

    if (exists.status !== 'draft' && exists.status !== 'cancelled') {
      return badRequest('يمكن فقط حذف أوامر البيع المسودة أو الملغية / Only draft or cancelled sales orders can be deleted')
    }

    await db.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({ where: { documentType: 'sales_order', documentId: id } })
      await tx.salesOrderLine.deleteMany({ where: { orderId: id } })
      await tx.salesOrder.delete({ where: { id } })
    })

    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
