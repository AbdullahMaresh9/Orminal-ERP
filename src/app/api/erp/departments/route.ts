import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const where: any = {}
    if (q) {
      where.OR = [{ code: { contains: q } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }]
    }
    const [data, total] = await Promise.all([
      db.department.findMany({ where, orderBy: { code: 'asc' }, skip, take: pageSize, include: { _count: { select: { employees: true } } } }),
      db.department.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.code || !body.nameAr) return badRequest('الكود والاسم مطلوبان')
    const created = await db.department.create({
      data: { code: body.code, nameAr: body.nameAr, nameEn: body.nameEn || body.nameAr, parentId: body.parentId, active: body.active ?? true },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
