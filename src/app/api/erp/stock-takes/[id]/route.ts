import { db } from '@/lib/db'
import { ok, badRequest, serverError, notFound, unauthorized } from '@/lib/erp/api-response'
import { postJournalEntry, inventoryAdjustmentPosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/stock-takes/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const st = await db.inventoryAdjustment.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        warehouse: { select: { id: true, nameAr: true, nameEn: true, code: true } },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, nameAr: true, nameEn: true, barcode: true, costPrice: true },
            },
          },
        },
      },
    })
    if (!st) return notFound('جلسة الجرد غير موجودة')

    const items = st.lines.map((l) => ({
      productId: l.productId,
      productName: l.product?.nameAr,
      productNameEn: l.product?.nameEn,
      sku: l.product?.sku,
      barcode: l.product?.barcode,
      systemQty: l.systemQty,
      countedQty: l.countedQty,
      diff: l.variance,
      unitCost: l.unitCost,
      varianceValue: l.variance * l.unitCost,
    }))

    return ok({
      ...st,
      storehouseId: st.warehouseId,
      storehouse: st.warehouse ? { id: st.warehouse.id, name: st.warehouse.nameAr, nameAr: st.warehouse.nameAr, code: st.warehouse.code } : null,
      itemsJson: JSON.stringify(items),
      items,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT /api/erp/stock-takes/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json()

    const existing = await db.inventoryAdjustment.findFirst({
      where: { id, companyId: context.companyId },
      include: { lines: true, warehouse: true },
    })
    if (!existing) return notFound('جلسة الجرد غير موجودة')

    // Idempotency: Prevent double posting
    if (existing.status === 'posted' && (body.status === 'posted' || body.status === 'completed')) {
      return badRequest('الجرد مُرحّل بالفعل، لا يمكن ترحيله مرة أخرى')
    }

    const companyId = existing.companyId
    const warehouseId = existing.warehouseId
    let newStatus = body.status ?? existing.status
    if (newStatus === 'completed') newStatus = 'posted'
    const postingDate = new Date()

    // Everything — line re-creation, stock moves, quant updates, and the journal —
    // must be one atomic unit so a closed-period rejection can't leave stock changed.
    await db.$transaction(async (tx) => {
      let linesData = existing.lines
      if (body.items && Array.isArray(body.items)) {
        await tx.inventoryAdjustmentLine.deleteMany({ where: { adjustmentId: id } })
        linesData = []
        for (const it of body.items) {
          const sysQty = Number(it.systemQty ?? 0)
          const countQty = Number(it.countedQty ?? sysQty)
          const varQty = countQty - sysQty
          const cost = Number(it.unitCost ?? 0)
          const created = await tx.inventoryAdjustmentLine.create({
            data: {
              adjustmentId: id,
              productId: it.productId,
              systemQty: sysQty,
              countedQty: countQty,
              variance: varQty,
              unitCost: cost,
            },
          })
          linesData.push(created)
        }
      }

      let journalEntryId = existing.journalEntryId
      if (newStatus === 'posted') {
        let totalVarianceValue = 0
        for (const l of linesData) {
          const varValue = l.variance * l.unitCost
          totalVarianceValue += varValue
          if (l.variance !== 0) {
            await tx.stockMove.create({
              data: {
                companyId,
                documentType: 'adjustment',
                documentId: id,
                productId: l.productId,
                destWarehouseId: l.variance > 0 ? warehouseId : null,
                sourceWarehouseId: l.variance < 0 ? warehouseId : null,
                quantity: Math.abs(l.variance),
                state: 'done',
                valuationAmount: varValue,
                costPrice: l.unitCost,
                postingDate,
              },
            })
            // Counted quantity is authoritative → set (not increment); guard against negatives
            if (l.countedQty < 0) throw new Error(`INVALID_COUNT: ${l.productId}`)
            const quant = await tx.stockQuant.findFirst({
              where: { productId: l.productId, warehouseId, locationId: null, lotId: null },
            })
            if (quant) {
              await tx.stockQuant.update({ where: { id: quant.id }, data: { quantity: l.countedQty } })
            } else {
              await tx.stockQuant.create({
                data: { productId: l.productId, warehouseId, quantity: l.countedQty },
              })
            }
          }
        }

        if (totalVarianceValue !== 0 && !journalEntryId) {
          const je = await postJournalEntry({
            companyId,
            journalType: 'general',
            postingDate,
            description: `تسوية جرد مخزني ${existing.code}`,
            refType: 'inventory_adjustment',
            refId: id,
            lines: inventoryAdjustmentPosting({ varianceAmount: totalVarianceValue }),
            userId: context.userId,
          }, tx)
          journalEntryId = je.id
        }
      }

      await tx.inventoryAdjustment.update({
        where: { id },
        data: {
          status: newStatus,
          journalEntryId,
          reason: body.notes || body.reason || existing.reason,
          updatedAt: new Date(),
        },
      })
    })

    const updated = await db.inventoryAdjustment.findUniqueOrThrow({
      where: { id },
      include: { lines: { include: { product: true } }, warehouse: true },
    })

    const items = updated.lines.map((l) => ({
      productId: l.productId,
      productName: l.product?.nameAr,
      productNameEn: l.product?.nameEn,
      sku: l.product?.sku,
      barcode: l.product?.barcode,
      systemQty: l.systemQty,
      countedQty: l.countedQty,
      diff: l.variance,
      unitCost: l.unitCost,
      varianceValue: l.variance * l.unitCost,
    }))

    return ok({
      ...updated,
      storehouseId: updated.warehouseId,
      storehouse: updated.warehouse ? { id: updated.warehouse.id, name: updated.warehouse.nameAr, code: updated.warehouse.code } : null,
      itemsJson: JSON.stringify(items),
      items,
    })
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.startsWith('PERIOD_CLOSED')) {
      return badRequest('الفترة المحاسبية لهذا التاريخ مغلقة')
    }
    if (typeof e?.message === 'string' && e.message.startsWith('INVALID_COUNT')) {
      return badRequest('الكمية المجرودة لا يمكن أن تكون سالبة')
    }
    return serverError(e.message)
  }
}

// DELETE /api/erp/stock-takes/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const existing = await db.inventoryAdjustment.findFirst({ where: { id, companyId: context.companyId } })
    if (!existing) return notFound('جلسة الجرد غير موجودة')
    if (existing.status === 'posted') return badRequest('لا يمكن حذف جلسة جرد مُرحّلة')

    await db.inventoryAdjustment.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
