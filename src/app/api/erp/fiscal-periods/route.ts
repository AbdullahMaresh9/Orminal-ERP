import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const fiscalYearId = url.searchParams.get('fiscalYearId')
    const state = url.searchParams.get('state')

    const where: any = {}
    if (q) where.name = { contains: q }
    if (fiscalYearId) where.fiscalYearId = fiscalYearId
    if (state) where.state = state

    const [data, total] = await Promise.all([
      db.fiscalPeriod.findMany({
        where,
        skip,
        take: pageSize,
        include: { fiscalYear: { select: { id: true, name: true } } },
        orderBy: { startDate: 'asc' },
      }),
      db.fiscalPeriod.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name) return badRequest('name is required')
    if (!body.fiscalYearId) return badRequest('fiscalYearId is required')
    if (!body.startDate) return badRequest('startDate is required')
    if (!body.endDate) return badRequest('endDate is required')

    const period = await db.fiscalPeriod.create({
      data: {
        fiscalYearId: body.fiscalYearId,
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        quarter: body.quarter,
        state: body.state ?? 'open',
      },
    })
    return created(period)
  } catch (e: any) {
    return serverError(e.message)
  }
}


