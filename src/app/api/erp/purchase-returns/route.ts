import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/purchase-returns
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
      db.purchaseReturn.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseReturn.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/purchase-returns — create (draft by default)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    // Generate code PR-YYYY-NNNNN
    const year = new Date().getFullYear()
    const count = await db.purchaseReturn.count({ where: { companyId: company.id } })
    let seq = count + 1
    let code = `PR-${year}-${String(seq).padStart(5, '0')}`
    while (await db.purchaseReturn.findUnique({ where: { code } })) {
      seq += 1
      code = `PR-${year}-${String(seq).padStart(5, '0')}`
    }

    const lines = body.lines ?? []
    if (body.originalInvoiceId) {
      const invoiceLines = await db.purchaseInvoiceLine.findMany({
        where: { invoiceId: body.originalInvoiceId },
      })
      const invQtyMap = new Map<string, number>()
      for (const il of invoiceLines) {
        invQtyMap.set(il.productId, (invQtyMap.get(il.productId) ?? 0) + il.quantity)
      }
      for (const l of lines) {
        if (!l.productId) continue
        const maxQty = invQtyMap.get(l.productId) ?? 0
        const retQty = Number(l.quantity) || 0
        if (maxQty > 0 && retQty > maxQty) {
          return badRequest(`الكمية المرجعة (${retQty}) تتجاوز الكمية المشتراة في الفاتورة الأصلية (${maxQty})`)
        }
      }
    }

    let subtotal = 0
    let taxTotal = 0
    const processedLines = lines.map((l: any) => {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
      const lineTax = lineSub * ((Number(l.taxRate) || 0) / 100)
      const total = lineSub + lineTax
      subtotal += lineSub
      taxTotal += lineTax
      return {
        productId: l.productId,
        description: l.description,
        quantity: Number(l.quantity) || 0,
        uomId: l.uomId,
        unitCost: Number(l.unitCost) || 0,
        taxRate: Number(l.taxRate) || 0,
        total,
      }
    })
    const total = subtotal + taxTotal

    const ret = await db.purchaseReturn.create({
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
