import { db } from '@/lib/db'
import { list, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/branches — list branches (multi-tenant scoping)
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId')

    const where: any = {}
    if (q) where.OR = [{ code: { contains: q } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }]
    if (companyId) where.companyId = companyId

    const [data, total] = await Promise.all([
      db.branch.findMany({
        where,
        skip,
        take: pageSize,
        include: { company: { select: { id: true, nameAr: true } } },
        orderBy: { code: 'asc' },
      }),
      db.branch.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}
