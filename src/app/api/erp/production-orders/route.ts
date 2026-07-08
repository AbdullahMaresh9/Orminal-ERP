import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const status = new URL(req.url).searchParams.get('status')
    const where: any = {}
    if (status) where.status = status
    if (q) where.code = { contains: q }
    const [data, total] = await Promise.all([
      db.productionOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } }, bom: { select: { id: true, code: true, nameAr: true } } } }),
      db.productionOrder.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.bomId || !body.productId) return badRequest('قائمة التركيب والمنتج مطلوبان')
    const company = await db.company.findFirst()
    if (!company) return badRequest('no company')
    const code = await nextNumber('production_order', company.id)
    const created = await db.productionOrder.create({
      data: {
        companyId: company.id,
        code,
        bomId: body.bomId,
        productId: body.productId,
        quantity: Number(body.quantity) || 1,
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null,
        status: body.status || 'draft',
        notes: body.notes,
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
