import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

// GET /api/erp/sales-quotations/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesQuotation.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Quotation not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update quotation details, status, or lines
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const exists = await db.salesQuotation.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!exists) return notFound('Quotation not found')

    // If quotation is already converted, disallow modifications unless setting same status
    if (exists.status === 'converted' && body.status && body.status !== 'converted') {
      return badRequest('لا يمكن تعديل عرض سعر تم تحويله بالكامل / Cannot modify a converted quotation')
    }

    const dataToUpdate: any = {}

    if (body.partnerId !== undefined) dataToUpdate.partnerId = body.partnerId
    if (body.status !== undefined) dataToUpdate.status = body.status
    if (body.notes !== undefined) dataToUpdate.notes = body.notes
    if (body.convertedSalesOrderId !== undefined) dataToUpdate.convertedSalesOrderId = body.convertedSalesOrderId
    if (body.quotationDate !== undefined) {
      dataToUpdate.quotationDate = body.quotationDate ? new Date(body.quotationDate) : new Date()
    }
    if (body.validUntil !== undefined) {
      dataToUpdate.validUntil = body.validUntil ? new Date(body.validUntil) : null
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
        await tx.salesQuotationLine.deleteMany({ where: { quotationId: id } })
        return tx.salesQuotation.update({
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

    const updated = await db.salesQuotation.update({
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

// DELETE — delete quotation if not converted to sales order
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesQuotation.findUnique({ where: { id } })
    if (!exists) return notFound('Quotation not found')

    if (exists.status === 'converted' || exists.convertedSalesOrderId) {
      return badRequest('لا يمكن حذف عرض سعر تم تحويله إلى أمر بيع / Cannot delete a converted quotation')
    }

    await db.salesQuotation.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
