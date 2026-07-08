import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }

    if (new URL(req.url).searchParams.get('tree') === 'true') {
      const roots = await db.costCenter.findMany({
        where: { ...where, parentId: null },
        include: { children: { include: { children: true } } },
        orderBy: { code: 'asc' },
      })
      return list(roots, roots.length, 1, 1000)
    }

    const [data, total] = await Promise.all([
      db.costCenter.findMany({
        where,
        skip,
        take: pageSize,
        include: { parent: { select: { id: true, code: true, nameAr: true } } },
        orderBy: { code: 'asc' },
      }),
      db.costCenter.count({ where }),
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

    let code = body.code
    if (!code) {
      const count = await db.costCenter.count()
      code = `CC-${String(count + 1).padStart(3, '0')}`
    }

    const cc = await db.costCenter.create({
      data: {
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        parentId: body.parentId,
        active: body.active ?? true,
      },
    })
    return created(cc)
  } catch (e: any) {
    return serverError(e.message)
  }
}
