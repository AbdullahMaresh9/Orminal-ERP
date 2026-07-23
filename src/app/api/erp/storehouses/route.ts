import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const branchId = url.searchParams.get('branchId')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (branchId) where.branchId = branchId

    const [data, total] = await Promise.all([
      db.warehouse.findMany({
        where,
        skip,
        take: pageSize,
        include: { branch: true },
        orderBy: { code: 'asc' },
      }),
      db.warehouse.count({ where }),
    ])

    // Map nameAr to name for the frontend storehouse expectations
    const mappedData = data.map((item: any) => ({
      ...item,
      name: item.nameAr,
    }))

    return list(mappedData, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // UI sends 'name', map it to nameAr
    const nameAr = body.name || body.nameAr
    if (!nameAr) return badRequest('name is required')
    if (!body.branchId) return badRequest('branchId is required')

    let code = body.code
    if (!code) {
      const count = await db.warehouse.count()
      code = `WH-${String(count + 1).padStart(3, '0')}`
    }

    const warehouse = await db.warehouse.create({
      data: {
        code,
        nameAr,
        nameEn: body.nameEn || '',
        branchId: body.branchId,
        address: body.address || '',
        active: body.active ?? true,
      },
      include: { branch: true },
    })

    const mapped = {
      ...warehouse,
      name: warehouse.nameAr,
    }
    return created(mapped)
  } catch (e: any) {
    return serverError(e.message)
  }
}
