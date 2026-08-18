import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, inventoryAdjustmentPosting } from '@/lib/erp/accounting-engine'
import { n } from '@/lib/erp/money'

// GET /api/erp/stock-takes
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { reason: { contains: q } },
        { warehouse: { nameAr: { contains: q } } },
        { warehouse: { nameEn: { contains: q } } },
      ]
    }
    if (status && status !== 'all') {
      where.status = status
    }

    const [data, total] = await Promise.all([
      db.inventoryAdjustment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          warehouse: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: {
            include: {
              product: { select: { id: true, sku: true, nameAr: true, nameEn: true, barcode: true, costPrice: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryAdjustment.count({ where }),
    ])

    const mapped = data.map((st: any) => {
      const items = (st.lines || []).map((l: any) => ({
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
      return {
        ...st,
        storehouseId: st.warehouseId,
        storehouse: st.warehouse ? { id: st.warehouse.id, name: st.warehouse.nameAr, nameAr: st.warehouse.nameAr, nameEn: st.warehouse.nameEn, code: st.warehouse.code } : null,
        itemsJson: JSON.stringify(items),
        items,
      }
    })

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

    let linesData: Array<{ productId: string; systemQty: number; countedQty: number; variance: number; unitCost: number }> = []

    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      linesData = body.items.map((it: any) => {
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
    } else {
      // Build snapshot from database based on countType & categoryId
      const productWhere: any = { active: true }
      if (body.countType === 'category' && body.categoryId) {
        productWhere.categoryId = body.categoryId
      }

      const products = await db.product.findMany({
        where: productWhere,
        include: {
          stockQuants: { where: { warehouseId } },
        },
      })

      linesData = products.map((p) => {
        const quant = p.stockQuants[0]
        const sysQty = quant ? n(quant.quantity) : 0
        return {
          productId: p.id,
          systemQty: sysQty,
          countedQty: sysQty,
          variance: 0,
          unitCost: n(p.costPrice) || 0,
        }
      })
    }

    const initialStatus = body.status ?? 'draft'

    const adj = await db.inventoryAdjustment.create({
      data: {
        companyId: company.id,
        code,
        warehouseId,
        adjustmentDate: body.countAsOf ? new Date(body.countAsOf) : new Date(),
        reason: body.notes || body.reason || (body.countType === 'category' ? 'جرد مخزني حسب الفئة' : 'جرد مخزني شامل'),
        status: initialStatus,
        lines: {
          create: linesData,
        },
      },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
      },
    })

    let journalEntryId: string | null = null
    if (initialStatus === 'posted' || initialStatus === 'approved') {
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
        journalEntryId = je.id

        await db.inventoryAdjustment.update({
          where: { id: adj.id },
          data: { journalEntryId: je.id, status: 'posted' },
        })
      }
    }

    const items = adj.lines.map((l) => ({
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

    return created({
      ...adj,
      storehouseId: adj.warehouseId,
      storehouse: { id: adj.warehouse.id, name: adj.warehouse.nameAr, nameAr: adj.warehouse.nameAr, nameEn: adj.warehouse.nameEn, code: adj.warehouse.code },
      itemsJson: JSON.stringify(items),
      items,
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
