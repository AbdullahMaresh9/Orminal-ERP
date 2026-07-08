import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, salesInvoicePosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/sales-invoices
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
      db.salesInvoice.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesInvoice.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-invoices — create + post journal entry (Dr AR / Cr Sales Revenue + Output VAT)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('sales_invoice', company.id, branch?.id)

    let subtotal = 0
    let taxTotal = 0
    const processedLines = body.lines.map((l: any) => {
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

    const status = body.status ?? 'posted'

    // Create invoice (atomic)
    const invoice = await db.salesInvoice.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        salesOrderId: body.salesOrderId,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        currencyId: body.currencyId,
        paymentTermId: body.paymentTermId,
        status: status === 'posted' ? 'posted' : 'draft',
        subtotal,
        taxTotal,
        discount: body.discount ?? 0,
        total,
        paid: 0,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: { create: processedLines },
      },
      include: { lines: true, partner: true },
    })

    // Update linked sales order invoiceStatus
    if (body.salesOrderId) {
      await db.salesOrder.update({
        where: { id: body.salesOrderId },
        data: { invoiceStatus: 'invoiced' },
      })
    }

    // If posted: post journal entry + update partner balance
    if (status === 'posted') {
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'sale',
        postingDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
        description: `فاتورة مبيعات ${code}`,
        refType: 'sales_invoice',
        refId: invoice.id,
        currencyId: body.currencyId,
        lines: salesInvoicePosting({ total, subtotal, taxTotal, partnerId: body.partnerId }),
        userId: body.createdBy,
      })

      await db.salesInvoice.update({
        where: { id: invoice.id },
        data: { journalEntryId: je.id, status: 'posted' },
      })

      // Update partner.currentBalance (increase AR)
      await db.partner.update({
        where: { id: body.partnerId },
        data: { currentBalance: { increment: total } },
      })
    }

    const result = await db.salesInvoice.findUnique({
      where: { id: invoice.id },
      include: { lines: { include: { product: true } }, partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
