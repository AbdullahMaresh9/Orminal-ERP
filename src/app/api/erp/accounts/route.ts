import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/accounts — chart of accounts; balance computed from JournalLines
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const active = url.searchParams.get('active')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
      ]
    }
    if (type) where.type = type
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    // Tree mode
    if (url.searchParams.get('tree') === 'true') {
      const roots = await db.account.findMany({
        where: { ...where, parentId: null },
        include: { children: { include: { children: true } } },
        orderBy: { code: 'asc' },
      })
      return list(roots, roots.length, 1, 1000)
    }

    const [data, total] = await Promise.all([
      db.account.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          parent: { select: { id: true, code: true, nameAr: true } },
          _count: { select: { journalLines: true } },
        },
        orderBy: { code: 'asc' },
      }),
      db.account.count({ where }),
    ])
    // Recompute balance from journal lines (debit/credit by account type)
    const accountsWithBalance = await Promise.all(
      data.map(async (a) => {
        const lines = await db.journalLine.aggregate({
          where: { accountId: a.id },
          _sum: { debit: true, credit: true },
        })
        const isDebitNormal = a.type === 'asset' || a.type === 'expense'
        const computed = isDebitNormal
          ? (lines._sum.debit ?? 0) - (lines._sum.credit ?? 0)
          : (lines._sum.credit ?? 0) - (lines._sum.debit ?? 0)
        return { ...a, computedBalance: computed, lineCount: a._count.journalLines }
      })
    )
    return list(accountsWithBalance, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/accounts — create new account (non-system)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.code) return badRequest('code is required')
    if (!body.nameAr) return badRequest('nameAr is required')
    if (!body.type) return badRequest('type is required')

    const existing = await db.account.findUnique({ where: { code: body.code } })
    if (existing) return badRequest('Account code already exists')

    const account = await db.account.create({
      data: {
        code: body.code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        type: body.type,
        subtype: body.subtype,
        parentId: body.parentId,
        isPosting: body.isPosting ?? true,
        isSystem: false, // cannot create system accounts via API
        balance: body.balance ?? 0,
        active: body.active ?? true,
      },
    })
    return created(account)
  } catch (e: any) {
    return serverError(e.message)
  }
}
