import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/purchase-orders
export async function GET(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = { companyId: context.companyId }
    if (q) where.OR = [{ code: { contains: q } }, { notes: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseOrder.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/purchase-orders — create. On confirm: optional budget check. No posting yet.
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('lines are required')
    if (body.lines.some((l: any) => !l.productId || !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0 || !Number.isFinite(Number(l.unitCost)) || Number(l.unitCost) < 0)) {
      return badRequest('Each line must have a product, positive quantity, and non-negative unit cost')
    }

    const branchId = body.branchId ?? context.branchId
    const [company, partner] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: body.partnerId, companyId: context.companyId } }),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('partner not found')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null
    if (branchId && !branch) return badRequest('branch not found')

    const status = body.status === 'confirmed' ? 'confirmed' : 'draft'

    const code = await nextNumber('purchase_order', company.id, branch?.id)

    let subtotal = 0
    let taxTotal = 0
    const processedLines = body.lines.map((l: any) => {
      const lineSubtotal = (l.quantity || 0) * (l.unitCost || 0) * (1 - (l.discountPercent || 0) / 100) - (l.discountAmount || 0)
      const lineTax = lineSubtotal * ((l.taxRate || 0) / 100)
      const total = lineSubtotal + lineTax
      subtotal += lineSubtotal
      taxTotal += lineTax
      return {
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        uomId: l.uomId,
        unitCost: l.unitCost,
        discountPercent: l.discountPercent ?? 0,
        discountAmount: l.discountAmount ?? 0,
        taxCodeId: l.taxCodeId,
        taxRate: l.taxRate ?? 0,
        total,
      }
    })
    const total = subtotal + taxTotal - (body.discount ?? 0)

    const po = await db.purchaseOrder.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        currencyId: body.currencyId,
        paymentTermId: body.paymentTermId,
        warehouseId: body.warehouseId,
        incoterms: body.incoterms,
        status,
        subtotal,
        taxTotal,
        discount: body.discount ?? 0,
        total,
        notes: body.notes,
        createdBy: context.userId,
        lines: { create: processedLines },
      },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    return created(po)
  } catch (e: any) {
    return serverError(e.message)
  }
}
