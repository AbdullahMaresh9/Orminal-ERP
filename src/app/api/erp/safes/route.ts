import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const branchId = url.searchParams.get('branchId')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (branchId) where.branchId = branchId

    const [data, total] = await Promise.all([
      db.safe.findMany({
        where,
        skip,
        take: pageSize,
        include: { account: { select: { id: true, code: true, nameAr: true } } },
        orderBy: { code: 'asc' },
      }),
      db.safe.count({ where }),
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

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')

    let code = body.code
    if (!code) {
      const count = await db.safe.count()
      code = `SAFE-${String(count + 1).padStart(3, '0')}`
    }

    const safe = await db.safe.create({
      data: {
        companyId: company.id,
        branchId: body.branchId,
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        currencyId: body.currencyId,
        accountId: body.accountId,
        balance: body.balance ?? 0,
        active: body.active ?? true,
      },
    })
    return created(safe)
  } catch (e: any) {
    return serverError(e.message)
  }
}
