import { db } from '@/lib/db'
import { list, serverError, parsePagination } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    const warehouseId = url.searchParams.get('warehouseId')
    const documentType = url.searchParams.get('documentType')
    const state = url.searchParams.get('state')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: any = {}
    if (productId) where.productId = productId
    if (documentType) where.documentType = documentType
    if (state) where.state = state
    if (warehouseId) {
      where.OR = [{ sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }]
    }
    if (from || to) {
      where.postingDate = {}
      if (from) where.postingDate.gte = new Date(from)
      if (to) where.postingDate.lte = new Date(to)
    }

    const [data, total] = await Promise.all([
      db.stockMove.findMany({
        where,
        orderBy: { postingDate: 'desc' },
        skip,
        take: pageSize,
        include: {
          product: { select: { id: true, sku: true, nameAr: true, nameEn: true } },
          sourceWarehouse: { select: { id: true, code: true, nameAr: true } },
          destWarehouse: { select: { id: true, code: true, nameAr: true } },
          lot: { select: { id: true, lotNumber: true } },
        },
      }),
      db.stockMove.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}
