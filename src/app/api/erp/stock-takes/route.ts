import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, inventoryAdjustmentPosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/stock-takes
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: any = {}
    if (q) where.code = { contains: q }
    if (status) where.status = status

    const [data, total] = await Promise.all([
      db.inventoryAdjustment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          warehouse: { select: { id: true, nameAr: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryAdjustment.count({ where }),
    ])

    const mapped = data.map((st: any) => ({
      ...st,
      storehouse: st.warehouse ? { id: st.warehouse.id, name: st.warehouse.nameAr, code: st.warehouse.code } : null,
    }))

    return list(mapped, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/stock-takes
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const warehouseId = body.warehouseId || body.storehouseId
    if (!warehouseId) return badRequest('المستودع مطلوب')

    const company = await db.company.findFirst()
    if (!company) return badRequest('لم يتم العثور على شركة بالمنظومة')

    const code = await nextNumber('inventory_adjustment', company.id)

    const linesData = (body.items || body.lines || []).map((it: any) => {
      const sysQty = Number(it.systemQty ?? 0)
      const countQty = Number(it.countedQty ?? sysQty)
      const varQty = countQty - sysQty
      const cost = Number(it.unitCost ?? 0)
      return {
        productId: it.productId,
        systemQty: sysQty,
        countedQty: countQty,
        variance: varQty,
        unitCost: cost,
      }
    })

    const status = body.status ?? 'draft'

    const adj = await db.inventoryAdjustment.create({
      data: {
        companyId: company.id,
        code,
        warehouseId,
        adjustmentDate: body.adjustmentDate ? new Date(body.adjustmentDate) : new Date(),
        reason: body.reason || body.notes || 'جرد مخزني دوري',
        status,
        lines: {
          create: linesData,
        },
      },
      include: { lines: { include: { product: true } }, warehouse: true },
    })

    if (status === 'posted' || status === 'approved') {
      let totalVarianceValue = 0
      await db.$transaction(async (tx) => {
        for (const l of linesData) {
          const varValue = l.variance * l.unitCost
          totalVarianceValue += varValue

          if (l.variance !== 0) {
            await tx.stockMove.create({
              data: {
                companyId: company.id,
                documentType: 'adjustment',
                documentId: adj.id,
                productId: l.productId,
                destWarehouseId: l.variance > 0 ? warehouseId : null,
                sourceWarehouseId: l.variance < 0 ? warehouseId : null,
                quantity: Math.abs(l.variance),
                state: 'done',
                valuationAmount: varValue,
                costPrice: l.unitCost,
                postingDate: new Date(),
              },
            })

            const existing = await tx.stockQuant.findFirst({
              where: { productId: l.productId, warehouseId, locationId: null, lotId: null },
            })
            if (existing) {
              await tx.stockQuant.update({
                where: { id: existing.id },
                data: { quantity: { increment: l.variance } },
              })
            } else if (l.variance > 0) {
              await tx.stockQuant.create({
                data: {
                  productId: l.productId,
                  warehouseId,
                  quantity: l.variance,
                },
              })
            }
          }
        }
      })

      if (totalVarianceValue !== 0) {
        const je = await postJournalEntry({
          companyId: company.id,
          journalType: 'general',
          postingDate: new Date(),
          description: `تسوية جرد مخزني ${code}`,
          refType: 'inventory_adjustment',
          refId: adj.id,
          lines: inventoryAdjustmentPosting({ varianceAmount: totalVarianceValue }),
        })

        await db.inventoryAdjustment.update({
          where: { id: adj.id },
          data: { journalEntryId: je.id, status: 'posted' },
        })
      }
    }

    return created({
      ...adj,
      storehouse: { id: adj.warehouse.id, name: adj.warehouse.nameAr, code: adj.warehouse.code },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
