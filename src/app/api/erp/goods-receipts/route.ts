import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, goodsReceiptPosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/goods-receipts
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
    if (q) where.code = { contains: q }
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.goodsReceipt.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, code: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          purchaseOrder: { select: { id: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.goodsReceipt.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — create; on validate: create StockMove, upsert StockQuant, post goods receipt journal
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (!body.warehouseId) return badRequest('warehouseId is required')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('goods_receipt', company.id, branch?.id)

    // Compute total from lines
    const lines = body.lines.map((l: any) => {
      const total = (l.receivedQty || 0) * (l.unitCost || 0)
      return { ...l, total }
    })
    const amount = lines.reduce((s: number, l: any) => s + l.total, 0)

    const status = body.status ?? 'draft'

    const grn = await db.goodsReceipt.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        purchaseOrderId: body.purchaseOrderId,
        partnerId: body.partnerId,
        warehouseId: body.warehouseId,
        receiptDate: body.receiptDate ? new Date(body.receiptDate) : new Date(),
        status,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: {
          create: lines.map((l: any) => ({
            productId: l.productId,
            purchaseOrderLineId: l.purchaseOrderLineId,
            orderedQty: l.orderedQty ?? 0,
            receivedQty: l.receivedQty,
            uomId: l.uomId,
            lotNumber: l.lotNumber,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
            unitCost: l.unitCost,
            total: l.total,
          })),
        },
      },
      include: { lines: { include: { product: true } } },
    })

    // On validate: create stock moves, upsert stock quants, post journal
    if (status === 'validated' || status === 'received') {
      // Create StockMoves + upsert StockQuants atomically
      await db.$transaction(async (tx) => {
        for (const l of lines) {
          // Append-only StockMove (in)
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'receipt',
              documentId: grn.id,
              productId: l.productId,
              destWarehouseId: body.warehouseId,
              quantity: l.receivedQty,
              uomId: l.uomId,
              state: 'done',
              valuationAmount: l.total,
              costPrice: l.unitCost,
              postingDate: new Date(),
            },
          })

          // Upsert StockQuant (increment quantity)
          const existing = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
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
                warehouseId: body.warehouseId,
                quantity: l.receivedQty,
              },
            })
          }
        }
      })

      // Post goods receipt journal (Dr Inventory / Cr GRNI)
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'purchase',
        postingDate: new Date(),
        description: `استلام بضاعة ${code}`,
        refType: 'goods_receipt',
        refId: grn.id,
        lines: goodsReceiptPosting({ amount }),
        userId: body.createdBy,
      })

      await db.goodsReceipt.update({
        where: { id: grn.id },
        data: { journalEntryId: je.id, status: 'validated' },
      })

      // Update purchase order receipt status
      if (body.purchaseOrderId) {
        await db.purchaseOrder.update({
          where: { id: body.purchaseOrderId },
          data: { receiptStatus: 'received', status: 'received' },
        })
      }
    }

    const result = await db.goodsReceipt.findUnique({
      where: { id: grn.id },
      include: { lines: { include: { product: true } }, partner: true, warehouse: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
