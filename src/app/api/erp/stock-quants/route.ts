import { db } from '@/lib/db'
import { list, serverError, parsePagination } from '@/lib/erp/api-response'

// GET /api/erp/stock-quants — current stock on hand per product/warehouse
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const warehouseId = url.searchParams.get('warehouseId')
    const productId = url.searchParams.get('productId')
    const lowStock = url.searchParams.get('lowStock')

    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (productId) where.productId = productId

    const [data, total] = await Promise.all([
      db.stockQuant.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              nameAr: true,
              nameEn: true,
              costPrice: true,
              salePrice: true,
              minStock: true,
              type: true,
              category: { select: { id: true, nameAr: true } },
              uom: { select: { id: true, nameAr: true, code: true } },
            },
          },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          location: { select: { id: true, code: true, nameAr: true } },
        },
        orderBy: { productId: 'asc' },
      }),
      db.stockQuant.count({ where }),
    ])

    let rows = data.map((q) => ({
      id: q.id,
      productId: q.productId,
      product: q.product,
      warehouseId: q.warehouseId,
      warehouse: q.warehouse,
      location: q.location,
      quantity: q.quantity,
      reservedQty: q.reservedQty,
      available: q.quantity - q.reservedQty,
      value: q.quantity * (q.product?.costPrice ?? 0),
      isLowStock: q.quantity <= (q.product?.minStock ?? 0),
    }))

    if (lowStock === 'true') {
      rows = rows.filter((r) => r.isLowStock)
    }

    return list(rows, lowStock === 'true' ? rows.length : total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}
