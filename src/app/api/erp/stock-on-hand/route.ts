import { db } from '@/lib/db'
import { list, serverError, parsePagination } from '@/lib/erp/api-response'
import { n } from '@/lib/erp/money'

// GET /api/erp/stock-on-hand — list stock quants with product+warehouse, filter by warehouse/product
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const warehouseId = url.searchParams.get('warehouseId')
    const productId = url.searchParams.get('productId')
    const onlyPositive = url.searchParams.get('onlyPositive')

    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (productId) where.productId = productId
    if (onlyPositive === 'true') where.quantity = { gt: 0 }

    const [data, total] = await Promise.all([
      db.stockQuant.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          product: { select: { id: true, sku: true, nameAr: true, nameEn: true, costPrice: true, salePrice: true, uom: { select: { code: true } } } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          location: { select: { id: true, code: true, nameAr: true } },
          lot: { select: { id: true, lotNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.stockQuant.count({ where }),
    ])

    // Compute available = quantity - reservedQty
    const enriched = data.map((q) => ({
      ...q,
      availableQty: n(q.quantity) - n(q.reservedQty),
      inventoryValue: n(q.quantity) * n(q.product?.costPrice ?? 0),
    }))

    return list(enriched, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}
