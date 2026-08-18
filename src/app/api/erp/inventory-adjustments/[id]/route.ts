import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry } from '@/lib/erp/accounting-engine'
import { n } from '@/lib/erp/money'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: true,
        reasonCode: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Inventory adjustment not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update; if transitioning to 'posted': create StockMoves, update StockQuants, post journal
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.inventoryAdjustment.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    })
    if (!exists) return notFound('Inventory adjustment not found')
    if (exists.status === 'posted' || exists.status === 'cancelled')
      return badRequest('Cannot edit posted or cancelled adjustment')

    const { id: _id, lines: _lines, createdAt: _c, updatedAt: _u, ...rest } = body

    // If transitioning to posted: process stock and journal
    if (rest.status === 'posted' && exists.status !== 'posted') {
      let gainAmount = 0
      let lossAmount = 0
      await db.$transaction(async (tx) => {
        for (const l of exists.lines) {
          const variance = (n(l.countedQty) ?? 0) - (n(l.systemQty) ?? 0)
          if (variance === 0) continue

          // StockMove
          await tx.stockMove.create({
            data: {
              companyId: exists.companyId,
              documentType: 'adjustment',
              documentId: id,
              productId: l.productId,
              sourceWarehouseId: variance < 0 ? exists.warehouseId : undefined,
              destWarehouseId: variance > 0 ? exists.warehouseId : undefined,
              quantity: Math.abs(variance),
              uomId: l.product?.uomId ?? undefined,
              state: 'done',
              valuationAmount: Math.abs(variance) * n(l.unitCost || 0),
              costPrice: l.unitCost,
              postingDate: new Date(),
            },
          })

          // Update StockQuant
          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: exists.warehouseId, locationId: null, lotId: null },
          })
          if (quant) {
            await tx.stockQuant.update({
              where: { id: quant.id },
              data: { quantity: { increment: variance } },
            })
          } else if (variance > 0) {
            await tx.stockQuant.create({
              data: {
                productId: l.productId,
                warehouseId: exists.warehouseId,
                quantity: variance,
              },
            })
          }

          const lineValue = Math.abs(variance) * n(l.unitCost || 0)
          if (variance > 0) gainAmount += lineValue
          else lossAmount += lineValue
        }
        await tx.inventoryAdjustment.update({ where: { id }, data: { status: 'posted' } })
      })

      const journalLines: any[] = []
      if (gainAmount > 0) {
        journalLines.push({ role: 'INVENTORY', debit: gainAmount, credit: 0, description: 'زيادة مخزون' })
        journalLines.push({ role: 'INVENTORY_GAIN', debit: 0, credit: gainAmount, description: 'إيراد آخر - زيادة مخزون' })
      }
      if (lossAmount > 0) {
        journalLines.push({ role: 'INVENTORY_LOSS', debit: lossAmount, credit: 0, description: 'مصروف - نقص مخزون' })
        journalLines.push({ role: 'INVENTORY', debit: 0, credit: lossAmount, description: 'نقص مخزون' })
      }

      if (journalLines.length > 0) {
        const je = await postJournalEntry({
          companyId: exists.companyId,
          journalType: 'general',
          postingDate: new Date(),
          description: `تسوية مخزون ${exists.code}`,
          refType: 'inventory_adjustment',
          refId: id,
          lines: journalLines,
        })
        await db.inventoryAdjustment.update({
          where: { id },
          data: { journalEntryId: je.id },
        })
      }

      const updated = await db.inventoryAdjustment.findUnique({
        where: { id },
        include: { lines: { include: { product: true } }, warehouse: true, reasonCode: true },
      })
      return ok(updated)
    }

    const updated = await db.inventoryAdjustment.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.inventoryAdjustment.findUnique({ where: { id } })
    if (!exists) return notFound('Inventory adjustment not found')
    if (exists.status !== 'draft') return badRequest('Only draft adjustments can be deleted')

    await db.inventoryAdjustment.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
