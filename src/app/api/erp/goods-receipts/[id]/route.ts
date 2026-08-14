import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, goodsReceiptPosting } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.goodsReceipt.findUnique({
      where: { id },
      include: {
        partner: true,
        warehouse: true,
        purchaseOrder: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Goods receipt not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.goodsReceipt.findUnique({ where: { id } })
    if (!exists) return notFound('Goods receipt not found')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body

    // If cancelling a receipt
    if (rest.status === 'cancelled') {
      const updated = await db.goodsReceipt.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { lines: { include: { product: true } } },
      })
      return ok(updated)
    }

    if (exists.status === 'validated' || exists.status === 'posted' || exists.status === 'cancelled') {
      return badRequest('Cannot edit validated or cancelled goods receipt')
    }

    // Update lines if provided (for draft)
    if (lines && Array.isArray(lines)) {
      await db.goodsReceiptLine.deleteMany({ where: { receiptId: id } })
      if (lines.length > 0) {
        await db.goodsReceiptLine.createMany({
          data: lines.map((l: any) => ({
            receiptId: id,
            productId: l.productId,
            orderedQty: Number(l.orderedQty) || 0,
            receivedQty: Number(l.receivedQty) || 0,
            lotNumber: l.lotNumber || undefined,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
            unitCost: Number(l.unitCost) || 0,
            total: (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0),
          })),
        })
      }
    }

    // If transitioning to validated/received
    if ((rest.status === 'validated' || rest.status === 'received') && exists.status !== 'validated' && exists.status !== 'received') {
      // First update base fields if any
      if (Object.keys(rest).length > 0) {
        await db.goodsReceipt.update({ where: { id }, data: rest })
      }

      const fullGrn = await db.goodsReceipt.findUnique({
        where: { id },
        include: { lines: true },
      })
      if (!fullGrn) return notFound('Goods receipt not found')

      const grnLines = fullGrn.lines
      const amount = grnLines.reduce((s, l) => s + l.total, 0)

      await db.$transaction(async (tx) => {
        for (const l of grnLines) {
          await tx.stockMove.create({
            data: {
              companyId: fullGrn.companyId,
              documentType: 'receipt',
              documentId: id,
              productId: l.productId,
              destWarehouseId: fullGrn.warehouseId,
              quantity: l.receivedQty,
              uomId: l.uomId,
              state: 'done',
              valuationAmount: l.total,
              costPrice: l.unitCost,
              postingDate: new Date(),
            },
          })

          const existing = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: fullGrn.warehouseId, locationId: null, lotId: null },
          })
          if (existing) {
            await tx.stockQuant.update({
              where: { id: existing.id },
              data: { quantity: { increment: l.receivedQty } },
            })
          } else {
            await tx.stockQuant.create({
              data: {
                productId: l.productId,
                warehouseId: fullGrn.warehouseId,
                quantity: l.receivedQty,
              },
            })
          }
        }
      })

      const je = await postJournalEntry({
        companyId: fullGrn.companyId,
        branchId: fullGrn.branchId ?? undefined,
        journalType: 'purchase',
        postingDate: new Date(),
        description: `استلام بضاعة ${fullGrn.code}`,
        refType: 'goods_receipt',
        refId: fullGrn.id,
        lines: goodsReceiptPosting({ amount }),
      })

      const updated = await db.goodsReceipt.update({
        where: { id },
        data: { ...rest, journalEntryId: je.id, status: 'validated' },
        include: { lines: { include: { product: true } } },
      })

      if (fullGrn.purchaseOrderId) {
        await db.purchaseOrder.update({
          where: { id: fullGrn.purchaseOrderId },
          data: { receiptStatus: 'received', status: 'received' },
        })
      }

      return ok(updated)
    }

    const updated = await db.goodsReceipt.update({
      where: { id },
      data: rest,
      include: { lines: { include: { product: true } } },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.goodsReceipt.findUnique({ where: { id } })
    if (!exists) return notFound('Goods receipt not found')
    if (exists.status !== 'draft' && exists.status !== 'cancelled') {
      return badRequest('Only draft or cancelled goods receipts can be deleted')
    }

    await db.goodsReceiptLine.deleteMany({ where: { receiptId: id } })
    await db.goodsReceipt.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
