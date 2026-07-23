import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const active = new URL(req.url).searchParams.get('active')
    const where: any = {}
    if (q) {
      where.OR = [{ code: { contains: q } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }]
    }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    const [data, total] = await Promise.all([
      db.workCenter.findMany({ where, orderBy: { code: 'asc' }, skip, take: pageSize }),
      db.workCenter.count({ where }),
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
    const exists = await db.workCenter.findUnique({ where: { code: body.code } })
    if (exists) return badRequest('الكود مستخدم مسبقاً')
    const created = await db.workCenter.create({
      data: {
        code: body.code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        capacityPerHour: Number(body.capacityPerHour) || 0,
        costPerHour: Number(body.costPerHour) || 0,
        active: body.active ?? true,
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
