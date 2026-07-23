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
        { name: { contains: q } },
      ]
    }
    if (branchId) where.branchId = branchId

    const [data, total] = await Promise.all([
      db.activity.findMany({
        where,
        skip,
        take: pageSize,
        include: { branch: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.activity.count({ where }),
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
    if (!body.branchId) return badRequest('branchId is required')

    let code = body.code
    if (!code) {
      const count = await db.activity.count()
      code = `ACT-${String(count + 1).padStart(3, '0')}`
    }

    const activity = await db.activity.create({
      data: {
        code,
        name: body.name,
        branchId: body.branchId,
      },
      include: { branch: true },
    })
    return created(activity)
  } catch (e: any) {
    return serverError(e.message)
  }
}
