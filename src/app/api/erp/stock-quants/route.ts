import { db } from '@/lib/db'
import { serverError, parsePagination } from '@/lib/erp/api-response'
import { NextResponse } from 'next/server'
import { n } from '@/lib/erp/money'

// GET /api/erp/stock-quants — current stock on hand per product/warehouse/location
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const warehouseId = url.searchParams.get('warehouseId')
    const productId = url.searchParams.get('productId')
    const categoryId = url.searchParams.get('categoryId')
    const lowStock = url.searchParams.get('lowStock')
    const status = url.searchParams.get('status')
    const hideZero = url.searchParams.get('hideZero') === '1' || url.searchParams.get('hideZero') === 'true'
    const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim()
    const sortBy = url.searchParams.get('sortBy')
    const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

    const where: any = {}
    if (warehouseId && warehouseId !== 'all') where.warehouseId = warehouseId
    if (productId) where.productId = productId
    if (categoryId && categoryId !== 'all') {
      where.product = { ...(where.product || {}), categoryId }
    }
    if (hideZero) {
      where.quantity = { not: 0 }
    }

    // Fetch all matching quants for total stats computation, search filtering, and sorting
    const allQuants = await db.stockQuant.findMany({
      where,
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
            categoryId: true,
            category: { select: { id: true, nameAr: true, nameEn: true } },
            uom: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          },
        },
        warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        location: { select: { id: true, code: true, nameAr: true, nameEn: true } },
      },
    })

    // Compute fields
    let mapped = allQuants.map((q) => {
      const minStock = n(q.product?.minStock ?? 0)
      const costPrice = n(q.product?.costPrice ?? 0)
      const available = n(q.quantity) - n(q.reservedQty)
      const value = n(q.quantity) * costPrice
      const isLowStock = n(q.quantity) <= minStock

      return {
        id: q.id,
        productId: q.productId,
        product: q.product,
        warehouseId: q.warehouseId,
        warehouse: q.warehouse,
        location: q.location,
        quantity: n(q.quantity),
        reservedQty: n(q.reservedQty),
        available,
        value,
        isLowStock,
      }
    })

    // Search query filtering (Product SKU, Arabic/English Name, Category, Warehouse, Location)
    if (q) {
      const qLower = q.toLowerCase()
      mapped = mapped.filter((r) => {
        const sku = r.product?.sku?.toLowerCase() || ''
        const pAr = r.product?.nameAr?.toLowerCase() || ''
        const pEn = r.product?.nameEn?.toLowerCase() || ''
        const catAr = r.product?.category?.nameAr?.toLowerCase() || ''
        const catEn = r.product?.category?.nameEn?.toLowerCase() || ''
        const wCode = r.warehouse?.code?.toLowerCase() || ''
        const wAr = r.warehouse?.nameAr?.toLowerCase() || ''
        const wEn = r.warehouse?.nameEn?.toLowerCase() || ''
        const lCode = r.location?.code?.toLowerCase() || ''
        const lAr = r.location?.nameAr?.toLowerCase() || ''
        const lEn = r.location?.nameEn?.toLowerCase() || ''

        return (
          sku.includes(qLower) ||
          pAr.includes(qLower) ||
          pEn.includes(qLower) ||
          catAr.includes(qLower) ||
          catEn.includes(qLower) ||
          wCode.includes(qLower) ||
          wAr.includes(qLower) ||
          wEn.includes(qLower) ||
          lCode.includes(qLower) ||
          lAr.includes(qLower) ||
          lEn.includes(qLower)
        )
      })
    }

    // Status filtering
    if (lowStock === 'true' || status === 'low') {
      mapped = mapped.filter((r) => r.isLowStock)
    } else if (status === 'available') {
      mapped = mapped.filter((r) => r.available > 0)
    } else if (status === 'out') {
      mapped = mapped.filter((r) => r.quantity <= 0)
    } else if (status === 'negative') {
      mapped = mapped.filter((r) => r.quantity < 0 || r.available < 0)
    }

    // Server-wide stats over matching dataset
    const totalItems = mapped.length
    const totalQuantity = mapped.reduce((sum, r) => sum + r.quantity, 0)
    const totalValue = mapped.reduce((sum, r) => sum + r.value, 0)
    const lowStockCount = mapped.filter((r) => r.isLowStock).length
    const outOfStockCount = mapped.filter((r) => r.quantity <= 0).length
    const negativeCount = mapped.filter((r) => r.quantity < 0 || r.available < 0).length

    // Sorting
    if (sortBy === 'quantity') {
      mapped.sort((a, b) => (sortDir === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity))
    } else if (sortBy === 'available') {
      mapped.sort((a, b) => (sortDir === 'asc' ? a.available - b.available : b.available - a.available))
    } else if (sortBy === 'value') {
      mapped.sort((a, b) => (sortDir === 'asc' ? a.value - b.value : b.value - a.value))
    } else if (sortBy === 'sku') {
      mapped.sort((a, b) => (sortDir === 'asc' ? a.product.sku.localeCompare(b.product.sku) : b.product.sku.localeCompare(a.product.sku)))
    } else {
      mapped.sort((a, b) => a.product.sku.localeCompare(b.product.sku))
    }

    // Paginate
    const paginated = mapped.slice(skip, skip + pageSize)
    const totalPages = Math.ceil(totalItems / pageSize) || 1

    return NextResponse.json({
      data: paginated,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          pageSize,
          total: totalItems,
          totalPages,
          hasMore: page < totalPages,
        },
        stats: {
          totalItems,
          totalQuantity,
          totalValue,
          lowStockCount,
          outOfStockCount,
          negativeCount,
        },
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
