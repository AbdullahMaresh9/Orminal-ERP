import { db } from '@/lib/db'
import { ok, badRequest, serverError, notFound } from '@/lib/erp/api-response'
import { postJournalEntry, inventoryAdjustmentPosting } from '@/lib/erp/accounting-engine'
import { n } from '@/lib/erp/money'

// GET /api/erp/stock-takes/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const st = await db.inventoryAdjustment.findUnique({
      where: { id },
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
      systemQty: n(l.systemQty),
      countedQty: n(l.countedQty),
      diff: n(l.variance),
      unitCost: n(l.unitCost),
      varianceValue: n(l.variance) * n(l.unitCost),
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
    const { id } = await params
    const body = await req.json()

    const existing = await db.inventoryAdjustment.findUnique({
      where: { id },
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

    let linesData = existing.lines
    if (body.items && Array.isArray(body.items)) {
      // Re-create lines with latest count & variances
      await db.inventoryAdjustmentLine.deleteMany({ where: { adjustmentId: id } })

      linesData = await Promise.all(
        body.items.map(async (it: any) => {
          const sysQty = Number(it.systemQty ?? 0)
          const countQty = Number(it.countedQty ?? sysQty)
          const varQty = countQty - sysQty
          const cost = Number(it.unitCost ?? 0)
          return db.inventoryAdjustmentLine.create({
            data: {
              adjustmentId: id,
              productId: it.productId,
              systemQty: sysQty,
              countedQty: countQty,
              variance: varQty,
              unitCost: cost,
            },
          })
        })
      )
    }

    let journalEntryId = existing.journalEntryId
    if (newStatus === 'posted') {
      let totalVarianceValue = 0

      await db.$transaction(async (tx) => {
        for (const l of linesData) {
          const varValue = n(l.variance) * n(l.unitCost)
          totalVarianceValue += varValue

          if (n(l.variance) !== 0) {
            // Append-only stock move
            await tx.stockMove.create({
              data: {
                companyId,
                documentType: 'adjustment',
                documentId: id,
                productId: l.productId,
                destWarehouseId: n(l.variance) > 0 ? warehouseId : null,
                sourceWarehouseId: n(l.variance) < 0 ? warehouseId : null,
                quantity: Math.abs(n(l.variance)),
                state: 'done',
                valuationAmount: varValue,
                costPrice: l.unitCost,
                postingDate: new Date(),
              },
            })

            // Update Stock Quant so system stock equals counted quantity
            const quant = await tx.stockQuant.findFirst({
              where: { productId: l.productId, warehouseId, locationId: null, lotId: null },
            })
            if (quant) {
              await tx.stockQuant.update({
                where: { id: quant.id },
                data: { quantity: l.countedQty },
              })
            } else {
              await tx.stockQuant.create({
                data: {
                  productId: l.productId,
                  warehouseId,
                  quantity: l.countedQty,
                },
              })
            }
          }
        }
      })

      // Post Journal Entry for total discrepancy value
      if (totalVarianceValue !== 0 && !journalEntryId) {
        const je = await postJournalEntry({
          companyId,
          journalType: 'general',
          postingDate: new Date(),
          description: `تسوية جرد مخزني ${existing.code}`,
          refType: 'inventory_adjustment',
          refId: id,
          lines: inventoryAdjustmentPosting({ varianceAmount: totalVarianceValue }),
        })
        journalEntryId = je.id
      }
    }

    const updated = await db.inventoryAdjustment.update({
      where: { id },
      data: {
        status: newStatus,
        journalEntryId,
        reason: body.notes || body.reason || existing.reason,
        updatedAt: new Date(),
      },
      include: { lines: { include: { product: true } }, warehouse: true },
    })

    const items = updated.lines.map((l) => ({
      productId: l.productId,
      productName: l.product?.nameAr,
      productNameEn: l.product?.nameEn,
      sku: l.product?.sku,
      barcode: l.product?.barcode,
      systemQty: n(l.systemQty),
      countedQty: n(l.countedQty),
      diff: n(l.variance),
      unitCost: n(l.unitCost),
      varianceValue: n(l.variance) * n(l.unitCost),
    }))

    return ok({
      ...updated,
      storehouseId: updated.warehouseId,
      storehouse: updated.warehouse ? { id: updated.warehouse.id, name: updated.warehouse.nameAr, code: updated.warehouse.code } : null,
      itemsJson: JSON.stringify(items),
      items,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE /api/erp/stock-takes/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.inventoryAdjustment.findUnique({ where: { id } })
    if (!existing) return notFound('جلسة الجرد غير موجودة')
    if (existing.status === 'posted') return badRequest('لا يمكن حذف جلسة جرد مُرحّلة')

    await db.inventoryAdjustment.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
