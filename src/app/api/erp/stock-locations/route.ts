import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const warehouseId = url.searchParams.get('warehouseId')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (warehouseId) where.warehouseId = warehouseId

    const [data, total] = await Promise.all([
      db.stockLocation.findMany({
        where,
        skip,
        take: pageSize,
        include: { warehouse: { select: { id: true, code: true, nameAr: true } } },
        orderBy: { code: 'asc' },
      }),
      db.stockLocation.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nameAr) return badRequest('nameAr is required')
    if (!body.warehouseId) return badRequest('warehouseId is required')

    let code = body.code
    if (!code) {
      const count = await db.stockLocation.count({ where: { warehouseId: body.warehouseId } })
      code = `LOC-${String(count + 1).padStart(3, '0')}`
    }

    const loc = await db.stockLocation.create({
      data: {
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        warehouseId: body.warehouseId,
        parentId: body.parentId,
        type: body.type ?? 'internal',
        active: body.active ?? true,
      },
      include: { warehouse: true },
    })
    return created(loc)
  } catch (e: any) {
    return serverError(e.message)
  }
}
