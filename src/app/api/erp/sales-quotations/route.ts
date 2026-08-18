import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/sales-quotations
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
    if (q) {
      where.OR = [{ code: { contains: q } }, { notes: { contains: q } }]
    }
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total, totalAll, acceptedCount, pendingCount, convertedCount] = await Promise.all([
      db.salesQuotation.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesQuotation.count({ where }),
      db.salesQuotation.count(),
      db.salesQuotation.count({ where: { OR: [{ status: 'accepted' }, { status: 'converted' }] } }),
      db.salesQuotation.count({ where: { OR: [{ status: 'draft' }, { status: 'sent' }] } }),
      db.salesQuotation.count({ where: { status: 'converted' } }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1
    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages },
        stats: { total: totalAll, accepted: acceptedCount, pending: pendingCount, converted: convertedCount },
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-quotations — create (no posting, no stock)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('sales_quotation', company.id, branch?.id)

    // Compute totals from lines
    const lines = body.lines ?? []
    let subtotal = 0
    let taxTotal = 0
    const processedLines = lines.map((l: any) => {
      const lineSubtotal = (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discountPercent || 0) / 100) - (l.discountAmount || 0)
      const lineTax = lineSubtotal * ((l.taxRate || 0) / 100)
      const total = lineSubtotal + lineTax
      subtotal += lineSubtotal
      taxTotal += lineTax
      return {
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        uomId: l.uomId,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent ?? 0,
        discountAmount: l.discountAmount ?? 0,
        taxCodeId: l.taxCodeId,
        taxRate: l.taxRate ?? 0,
        total,
      }
    })
    const total = subtotal + taxTotal - (body.discount ?? 0)

    const quotation = await db.salesQuotation.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        quotationDate: body.quotationDate ? new Date(body.quotationDate) : new Date(),
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        priceListId: body.priceListId,
        currencyId: body.currencyId,
        paymentTermId: body.paymentTermId,
        status: body.status ?? 'draft',
        subtotal,
        taxTotal,
        discount: body.discount ?? 0,
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
    return created(quotation)
  } catch (e: any) {
    return serverError(e.message)
  }
}
