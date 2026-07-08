import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/categories — tree or flat list
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (type) where.type = type

    if (url.searchParams.get('tree') === 'true') {
      const roots = await db.category.findMany({
        where: { ...where, parentId: null },
        include: { children: { include: { children: true } } },
        orderBy: { code: 'asc' },
      })
      return list(roots, roots.length, 1, 1000)
    }

    const [data, total] = await Promise.all([
      db.category.findMany({
        where,
        skip,
        take: pageSize,
        include: { parent: { select: { id: true, nameAr: true, code: true } } },
        orderBy: { code: 'asc' },
      }),
      db.category.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/categories
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nameAr) return badRequest('nameAr is required')

    let code = body.code
    if (!code) {
      const count = await db.category.count()
      code = `CAT-${String(count + 1).padStart(3, '0')}`
    }

    const rec = await db.category.create({
      data: {
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        parentId: body.parentId,
        type: body.type ?? 'product',
        active: body.active ?? true,
      },
    })
    return created(rec)
  } catch (e: any) {
    return serverError(e.message)
  }
}
