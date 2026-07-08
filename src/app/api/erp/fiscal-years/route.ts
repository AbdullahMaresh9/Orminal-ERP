import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/fiscal-years
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId')

    const where: any = {}
    if (q) where.name = { contains: q }
    if (companyId) where.companyId = companyId

    const [data, total] = await Promise.all([
      db.fiscalYear.findMany({
        where,
        skip,
        take: pageSize,
        include: { periods: { orderBy: { startDate: 'asc' } }, company: { select: { id: true, nameAr: true } } },
        orderBy: { startDate: 'desc' },
      }),
      db.fiscalYear.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/fiscal-years — create with optional auto-periods
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name) return badRequest('name is required')
    if (!body.startDate) return badRequest('startDate is required')
    if (!body.endDate) return badRequest('endDate is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    const fy = await db.fiscalYear.create({
      data: {
        companyId: body.companyId ?? company.id,
        name: body.name,
        startDate,
        endDate,
        state: body.state ?? 'open',
      },
      include: { periods: true },
    })

    // Auto-generate 12 monthly periods if requested
    if (body.autoPeriods) {
      const periodMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      const periods = []
      const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      while (cur <= endDate) {
        const pStart = new Date(cur)
        const pEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59)
        const q = Math.floor(cur.getMonth() / 3) + 1
        periods.push({
          fiscalYearId: fy.id,
          name: `${periodMonths[cur.getMonth()]} ${cur.getFullYear()}`,
          startDate: pStart,
          endDate: pEnd,
          quarter: q,
          state: 'open',
        })
        cur.setMonth(cur.getMonth() + 1)
      }
      await db.fiscalPeriod.createMany({ data: periods })
    }

    const withPeriods = await db.fiscalYear.findUnique({
      where: { id: fy.id },
      include: { periods: { orderBy: { startDate: 'asc' } } },
    })
    return created(withPeriods)
  } catch (e: any) {
    return serverError(e.message)
  }
}
