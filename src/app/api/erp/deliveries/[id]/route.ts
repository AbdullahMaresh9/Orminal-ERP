import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, cogsPosting } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.delivery.findUnique({
      where: { id },
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
    const { id } = await params
    const body = await req.json()
    const exists = await db.delivery.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!exists) return notFound('Delivery not found')
    if (exists.status === 'done' || exists.status === 'cancelled')
      return badRequest('Cannot edit done or cancelled delivery')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body

    // If transitioning to done: process stock
    if (rest.status === 'done' && exists.status !== 'done') {
      let cogsAmount = 0
      await db.$transaction(async (tx) => {
        for (const l of exists.lines) {
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
              postingDate: new Date(),
            },
          })

          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: exists.warehouseId, locationId: null, lotId: null },
          })
          if (quant) {
            await tx.stockQuant.update({
              where: { id: quant.id },
              data: { quantity: { decrement: l.deliveredQty } },
            })
          }
        }
        await tx.delivery.update({ where: { id }, data: { status: 'done' } })
      })

      if (cogsAmount > 0) {
        const je = await postJournalEntry({
          companyId: exists.companyId,
          branchId: exists.branchId ?? undefined,
          journalType: 'general',
          postingDate: new Date(),
          description: `تكلفة بضاعة مباعة - تسليم ${exists.code}`,
          refType: 'delivery',
          refId: id,
          lines: cogsPosting({ amount: cogsAmount }),
        })
        await db.delivery.update({ where: { id }, data: { journalEntryId: je.id } })
      }

      if (exists.salesOrderId) {
        await db.salesOrder.update({
          where: { id: exists.salesOrderId },
          data: { deliveryStatus: 'delivered', status: 'delivered' },
        })
      }
      const updated = await db.delivery.findUnique({
        where: { id },
        include: { lines: { include: { product: true } } },
      })
      return ok(updated)
    }

    const updated = await db.delivery.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.delivery.findUnique({ where: { id } })
    if (!exists) return notFound('Delivery not found')
    if (exists.status !== 'draft') return badRequest('Only draft deliveries can be deleted')

    await db.delivery.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
