import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/purchase-orders
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
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
    const body = await req.json().catch(() => ({}))
    if (!body.partnerId) return badRequest('اختر المورد')
    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      return badRequest('يجب إدخال بنود في أمر الشراء')
    }
    // Validate partner exists and is active


    const company = await db.company.findFirst()
    if (!company) return badRequest('لم يتم العثور على شركة في النظام')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const companyId = body.companyId || company.id
    const branchId = body.branchId || branch?.id

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
        status: body.status || 'draft',
        subtotal,
        taxTotal,
        discount: overallDiscount,
        total,
        notes: body.notes || null,
        createdBy: body.createdBy || null,
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

