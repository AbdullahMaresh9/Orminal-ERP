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
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } } } },
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

// POST /api/erp/purchase-orders — create PO as DRAFT
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json().catch(() => ({}))
    if (!body.partnerId) return badRequest('اختر المورد')
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return badRequest('يجب إدخال بنود في أمر الشراء')
    }
    if (body.lines.some((l: any) => !l.productId || !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0 || !Number.isFinite(Number(l.unitCost)) || Number(l.unitCost) < 0)) {
      return badRequest('كل بند يجب أن يحتوي على منتج، كمية موجبة، وتكلفة وحدة غير سالبة')
    }

    const branchId = body.branchId ?? context.branchId
    const [company, partner] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: body.partnerId, companyId: context.companyId } }),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('المورد غير موجود')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null
    if (branchId && !branch) return badRequest('branch not found')

    const status = body.status === 'confirmed' ? 'confirmed' : 'draft'
    const companyId = context.companyId

    const code = await nextNumber('purchase_order', companyId, branchId)

    const validLines = body.lines.filter((l: any) => l.productId && Number(l.quantity) > 0)
    if (validLines.length === 0) {
      return badRequest('يجب إدخال بند واحد صالح على الأقل بكمية أكبر من صفر')
    }

    let subtotal = 0
    let taxTotal = 0

    const processedLines = validLines.map((l: any) => {
      const qty = Math.max(0, Number(l.quantity) || 0)
      const cost = Math.max(0, Number(l.unitCost) || 0)
      const discPercent = Math.max(0, Number(l.discountPercent) || 0)
      const discAmount = Math.max(0, Number(l.discountAmount) || 0)
      const taxRate = Math.max(0, Number(l.taxRate) || 0)

      const lineSubtotal = Math.max(0, qty * cost * (1 - discPercent / 100) - discAmount)
      const lineTax = lineSubtotal * (taxRate / 100)
      const lineTotal = lineSubtotal + lineTax

      subtotal += lineSubtotal
      taxTotal += lineTax

      return {
        productId: l.productId,
        description: l.description || null,
        quantity: qty,
        uomId: l.uomId || null,
        unitCost: cost,
        discountPercent: discPercent,
        discountAmount: discAmount,
        taxCodeId: l.taxCodeId || null,
        taxRate: taxRate,
        total: lineTotal,
      }
    })

    const overallDiscount = Math.max(0, Number(body.discount) || 0)
    const total = Math.max(0, subtotal + taxTotal - overallDiscount)

    const createdPo = await db.purchaseOrder.create({
      data: {
        companyId,
        branchId,
        code,
        partnerId: body.partnerId,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        currencyId: body.currencyId || null,
        paymentTermId: body.paymentTermId || null,
        warehouseId: body.warehouseId || null,
        incoterms: body.incoterms || null,
        status,
        subtotal,
        taxTotal,
        discount: overallDiscount,
        total,
        notes: body.notes || null,
        createdBy: context.userId,
        lines: { create: processedLines },
      },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })

    return created(createdPo)
  } catch (e: any) {
    return serverError(e.message)
  }
}

