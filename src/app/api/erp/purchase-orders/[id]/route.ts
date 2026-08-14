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
    const body = await req.json().catch(() => ({}))

    const exists = await db.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!exists) return notFound('أمر الشراء غير موجود')

    // Once a PO has been received/billed/paid/cancelled it is locked against
    // structural edits — only a safe status-only transition is allowed.
    if (['received', 'billed', 'paid', 'cancelled'].includes(exists.status)) {
      const onlyStatusChange = Object.keys(body).every((k) => k === 'status')
      if (onlyStatusChange && ['draft', 'confirmed', 'cancelled'].includes(body.status)) {
        const updatedStatus = await db.purchaseOrder.update({
          where: { id },
          data: { status: body.status },
          include: { partner: true, lines: { include: { product: true } } },
        })
        return ok(updatedStatus)
      }
      return badRequest('لا يمكن تعديل بنود أو إجماليات أمر شراء مستلم أو مدفوع أو ملغي.')
    }

    // Whitelist safe editable fields only — never let totals or scope be
    // overwritten directly from the request body.
    const { notes, expectedDate, orderDate, paymentTermId, currencyId, warehouseId, incoterms, status, discount, lines } = body

    const updateData: any = {
      notes,
      paymentTermId,
      currencyId,
      warehouseId,
      incoterms,
      status: ['draft', 'confirmed', 'cancelled'].includes(status) ? status : undefined,
    }

    if (orderDate) {
      updateData.orderDate = new Date(orderDate)
    }
    if (expectedDate !== undefined) {
      updateData.expectedDate = expectedDate ? new Date(expectedDate) : null
    }

    const result = await db.$transaction(async (tx) => {
      if (lines && Array.isArray(lines)) {
        const validLines = lines.filter((l: any) => l.productId && Number(l.quantity) > 0)
        await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } })

        let subtotal = 0
        let taxTotal = 0
        const processedLines = validLines.map((l: any) => {
          const qty = Math.max(0, Number(l.quantity) || 0)
          const cost = Math.max(0, Number(l.unitCost) || 0)
          const discPercent = Math.max(0, Number(l.discountPercent) || 0)
          const discAmount = Math.max(0, Number(l.discountAmount) || 0)
          const taxRate = Math.max(0, Number(l.taxRate) || 0)

          const lineSubtotal = Math.max(0, qty * cost * (1 - discPercent / 100) - discAmount)
          const lineTax = lineSubtotal * (taxRate / 100)
          const lineTotal = lineSubtotal + lineTax

          subtotal += lineSubtotal
          taxTotal += lineTax

          return {
            productId: l.productId,
            description: l.description || null,
            quantity: qty,
            uomId: l.uomId || null,
            unitCost: cost,
            discountPercent: discPercent,
            discountAmount: discAmount,
            taxCodeId: l.taxCodeId || null,
            taxRate: taxRate,
            total: lineTotal,
          }
        })

        const overallDiscount = Math.max(0, Number(discount ?? exists.discount) || 0)
        const total = Math.max(0, subtotal + taxTotal - overallDiscount)

        updateData.subtotal = subtotal
        updateData.taxTotal = taxTotal
        updateData.discount = overallDiscount
        updateData.total = total
        updateData.lines = { create: processedLines }
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: {
          partner: true,
          lines: { include: { product: true } },
        },
      })
    })

    return ok(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseOrder.findUnique({ where: { id } })
    if (!exists) return notFound('أمر الشراء غير موجود')

    if (exists.status === 'received' || exists.status === 'paid') {
      return badRequest('لا يمكن حذف أمر شراء مستلم أو مدفوع.')
    }

    await db.$transaction(async (tx) => {
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } })
      await tx.purchaseOrder.delete({ where: { id } })
    })

    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}

