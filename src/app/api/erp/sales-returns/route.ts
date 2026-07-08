import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/sales-returns
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
    if (q) where.OR = [{ code: { contains: q } }, { reason: { contains: q } }, { notes: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.salesReturn.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesReturn.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-returns — create (draft by default; no posting yet)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    // Generate code SR-YYYY-NNNNN
    const year = new Date().getFullYear()
    const count = await db.salesReturn.count({ where: { companyId: company.id } })
    let seq = count + 1
    let code = `SR-${year}-${String(seq).padStart(5, '0')}`
    // Ensure uniqueness (handle deletions)
    while (await db.salesReturn.findUnique({ where: { code } })) {
      seq += 1
      code = `SR-${year}-${String(seq).padStart(5, '0')}`
    }

    // Compute totals from lines
    const lines = body.lines ?? []
    let subtotal = 0
    let taxTotal = 0
    const processedLines = lines.map((l: any) => {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
      const lineTax = lineSub * ((Number(l.taxRate) || 0) / 100)
      const total = lineSub + lineTax
      subtotal += lineSub
      taxTotal += lineTax
      return {
        productId: l.productId,
        description: l.description,
        quantity: Number(l.quantity) || 0,
        uomId: l.uomId,
        unitPrice: Number(l.unitPrice) || 0,
        taxRate: Number(l.taxRate) || 0,
        total,
      }
    })
    const total = subtotal + taxTotal

    const ret = await db.salesReturn.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        originalInvoiceId: body.originalInvoiceId || null,
        date: body.date ? new Date(body.date) : new Date(),
        reason: body.reason,
        status: body.status ?? 'draft',
        subtotal,
        taxTotal,
        total,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: { create: processedLines },
      },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    return created(ret)
  } catch (e: any) {
    return serverError(e.message)
  }
}
