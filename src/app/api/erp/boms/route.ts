import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const where: any = {}
    if (q) {
      where.OR = [{ code: { contains: q } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }]
    }
    const [data, total] = await Promise.all([
      db.bom.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } }, components: { include: { product: { select: { id: true, sku: true, nameAr: true } } } } } }),
      db.bom.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.productId) return badRequest('المنتج مطلوب')
    const company = await db.company.findFirst()
    if (!company) return badRequest('no company')
    const code = await nextNumber('bom', company.id)
    const created = await db.bom.create({
      data: {
        companyId: company.id,
        code,
        nameAr: body.nameAr || 'قائمة تركيب',
        nameEn: body.nameEn,
        productId: body.productId,
        quantity: Number(body.quantity) || 1,
        version: body.version || 1,
        status: body.status || 'draft',
        active: true,
        components: body.components ? { create: body.components.map((c: any) => ({ productId: c.productId, quantity: Number(c.quantity), scrapPercent: Number(c.scrapPercent) || 0 })) } : undefined,
      },
      include: { components: true },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
