import { db } from '@/lib/db'
import { list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/journals — list journals
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

    const [data, total] = await Promise.all([
      db.journal.findMany({
        where,
        skip,
        take: pageSize,
        include: { _count: { select: { journalEntries: true } } },
        orderBy: { code: 'asc' },
      }),
      db.journal.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.code) return badRequest('code is required')
    if (!body.nameAr) return badRequest('nameAr is required')

    const journal = await db.journal.create({
      data: {
        code: body.code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        type: body.type ?? 'general',
        defaultDebitAccount: body.defaultDebitAccount,
        defaultCreditAccount: body.defaultCreditAccount,
        active: body.active ?? true,
      },
    })
    return list([journal], 1, 1, 1)
  } catch (e: any) {
    return serverError(e.message)
  }
}
