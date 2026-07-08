import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/purchase-requests
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: any = {}
    if (q) where.code = { contains: q }
    if (status) where.status = status

    const [data, total] = await Promise.all([
      db.purchaseRequest.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseRequest.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — create (no posting)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('purchase_request', company.id, branch?.id)

    const pr = await db.purchaseRequest.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        requesterId: body.requesterId,
        department: body.department,
        requiredDate: body.requiredDate ? new Date(body.requiredDate) : undefined,
        status: body.status ?? 'draft',
        notes: body.notes,
        lines: {
          create: body.lines.map((l: any) => ({
            productId: l.productId,
            quantity: l.quantity,
            uomId: l.uomId,
            requiredDate: l.requiredDate ? new Date(l.requiredDate) : undefined,
            costCenterId: l.costCenterId,
            notes: l.notes,
          })),
        },
      },
      include: { lines: { include: { product: true } } },
    })
    return created(pr)
  } catch (e: any) {
    return serverError(e.message)
  }
}
