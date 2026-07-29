import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/products
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const categoryId = url.searchParams.get('categoryId')
    const type = url.searchParams.get('type')
    const active = url.searchParams.get('active')

    const where: any = {}
    if (q) {
      where.OR = [
        { sku: { contains: q } },
        { barcode: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (categoryId) where.categoryId = categoryId
    if (type) where.type = type
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    const warehouseId = url.searchParams.get('warehouseId') || url.searchParams.get('storehouseId')

    const [data, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          category: { select: { id: true, nameAr: true, code: true } },
          uom: { select: { id: true, nameAr: true, code: true } },
          taxCode: { select: { id: true, code: true, rate: true } },
          valuationAccount: { select: { id: true, code: true, nameAr: true } },
          cogsAccount: { select: { id: true, code: true, nameAr: true } },
          revenueAccount: { select: { id: true, code: true, nameAr: true } },
          stockQuants: { select: { warehouseId: true, quantity: true, reservedQty: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.product.count({ where }),
    ])

    const enriched = data.map((p: any) => {
      const totalStock = p.stockQuants?.reduce((sum: number, q: any) => sum + (q.quantity || 0), 0) ?? 0
      const totalReserved = p.stockQuants?.reduce((sum: number, q: any) => sum + (q.reservedQty || 0), 0) ?? 0

      const whQuants = warehouseId ? p.stockQuants?.filter((q: any) => q.warehouseId === warehouseId) : p.stockQuants
      const whStock = whQuants?.reduce((sum: number, q: any) => sum + (q.quantity || 0), 0) ?? 0
      const whReserved = whQuants?.reduce((sum: number, q: any) => sum + (q.reservedQty || 0), 0) ?? 0

      return {
        ...p,
        stock: totalStock,
        availableStock: totalStock - totalReserved,
        warehouseStock: whStock,
        warehouseAvailableStock: whStock - whReserved,
      }
    })

    return list(enriched, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/products
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nameAr) return badRequest('nameAr is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')

    let sku = body.sku
    if (!sku) {
      const count = await db.product.count()
      sku = `SKU-${String(count + 1).padStart(5, '0')}`
    }

    const product = await db.product.create({
      data: {
        sku,
        barcode: body.barcode,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        description: body.description,
        companyId: company.id,
        categoryId: body.categoryId,
        uomId: body.uomId,
        type: body.type ?? 'product',
        tracking: body.tracking ?? 'none',
        costPrice: body.costPrice ?? 0,
        salePrice: body.salePrice ?? 0,
        costingMethod: body.costingMethod ?? 'fifo',
        taxCodeId: body.taxCodeId,
        minStock: body.minStock ?? 0,
        maxStock: body.maxStock ?? 0,
        reorderPoint: body.reorderPoint ?? 0,
        valuationAccountId: body.valuationAccountId,
        cogsAccountId: body.cogsAccountId,
        revenueAccountId: body.revenueAccountId,
        image: body.image,
        active: body.active ?? true,
      },
    })
    return created(product)
  } catch (e: any) {
    return serverError(e.message)
  }
}
