import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError, unauthorized, conflict } from '@/lib/erp/api-response'
import { postJournalEntry, cogsPosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const item = await db.delivery.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        partner: true,
        warehouse: true,
        salesOrder: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Delivery not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json()
    const exists = await db.delivery.findFirst({
      where: { id, companyId: context.companyId },
      include: { lines: true },
    })
    if (!exists) return notFound('Delivery not found')
    if (exists.status === 'done' || exists.status === 'cancelled')
      return badRequest('Cannot edit done or cancelled delivery')

    // If transitioning to done: process stock-out + COGS atomically (journal INSIDE the tx)
    if (body.status === 'done' && exists.status !== 'done') {
      const deliveryDate = new Date()
      try {
        await db.$transaction(async (tx) => {
          let cogsAmount = 0
          for (const l of exists.lines) {
            const quant = await tx.stockQuant.findFirst({
              where: { productId: l.productId, warehouseId: exists.warehouseId, locationId: null, lotId: null },
            })
            const currentQty = quant?.quantity ?? 0
            if (currentQty < l.deliveredQty) {
              const product = await tx.product.findUnique({ where: { id: l.productId } })
              throw new Error(`INSUFFICIENT_STOCK: الكمية المتوفرة في المخزون غير كافية للمنتج ${product?.nameAr || l.productId} (المتاح: ${currentQty}، المطلوب: ${l.deliveredQty})`)
            }

            const product = await tx.product.findUnique({ where: { id: l.productId } })
            const cost = product?.costPrice ?? 0
            const lineCost = cost * l.deliveredQty
            cogsAmount += lineCost

            await tx.stockMove.create({
              data: {
                companyId: exists.companyId,
                documentType: 'delivery',
                documentId: id,
                productId: l.productId,
                sourceWarehouseId: exists.warehouseId,
                quantity: l.deliveredQty,
                uomId: l.uomId,
                state: 'done',
                valuationAmount: lineCost,
                costPrice: cost,
                postingDate: deliveryDate,
              },
            })

            if (!quant || quant.quantity < l.deliveredQty) throw new Error(`INSUFFICIENT_STOCK: ${l.productId}`)
            await tx.stockQuant.update({
              where: { id: quant.id },
              data: { quantity: { decrement: l.deliveredQty } },
            })
          }

          // COGS journal must be inside the transaction so a closed period cannot
          // leave stock decremented without a matching journal.
          if (cogsAmount > 0) {
            const je = await postJournalEntry({
              companyId: exists.companyId,
              branchId: exists.branchId ?? undefined,
              journalType: 'general',
              postingDate: deliveryDate,
              description: `تكلفة بضاعة مباعة - تسليم ${exists.code}`,
              refType: 'delivery',
              refId: id,
              lines: cogsPosting({ amount: cogsAmount }),
              userId: context.userId,
            }, tx)
            await tx.delivery.update({ where: { id }, data: { journalEntryId: je.id } })
          }

          await tx.delivery.update({ where: { id }, data: { status: 'done' } })

          if (exists.salesOrderId) {
            await tx.salesOrder.update({
              where: { id: exists.salesOrderId },
              data: { deliveryStatus: 'delivered', status: 'delivered' },
            })
          }
        })
      } catch (err: any) {
        if (typeof err?.message === 'string' && err.message.startsWith('INSUFFICIENT_STOCK')) {
          return conflict(err.message.replace('INSUFFICIENT_STOCK: ', '') || 'الكمية المتوفرة غير كافية', 'INSUFFICIENT_STOCK')
        }
        if (typeof err?.message === 'string' && err.message.startsWith('PERIOD_CLOSED')) {
          return badRequest('الفترة المحاسبية لهذا التاريخ مغلقة')
        }
        return serverError(err.message || 'خطأ في عملية إخراج المخزون')
      }

      const updated = await db.delivery.findUnique({
        where: { id },
        include: { lines: { include: { product: true } } },
      })
      return ok(updated)
    }

    // Non-status edits: whitelist safe descriptive fields only (never scope/warehouse/status shortcuts)
    const { notes, deliveryDate } = body
    const updated = await db.delivery.update({
      where: { id },
      data: {
        notes,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const exists = await db.delivery.findFirst({ where: { id, companyId: context.companyId } })
    if (!exists) return notFound('Delivery not found')
    if (exists.status !== 'draft') return badRequest('Only draft deliveries can be deleted')

    await db.delivery.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
