import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, purchaseInvoicePosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/purchase-invoices
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
    if (q) where.OR = [{ code: { contains: q } }, { vendorBillNo: { contains: q } }, { notes: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.purchaseInvoice.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseInvoice.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — vendor bill. On post: post journal, update partner.currentBalance (increase AP)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('purchase_invoice', company.id, branch?.id)

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
    const total = subtotal + taxTotal

    const status = body.status ?? 'posted'

    const invoice = await db.purchaseInvoice.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        purchaseOrderId: body.purchaseOrderId,
        billDate: body.billDate ? new Date(body.billDate) : new Date(),
        accountingDate: body.accountingDate ? new Date(body.accountingDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        vendorBillNo: body.vendorBillNo,
        currencyId: body.currencyId,
        paymentTermId: body.paymentTermId,
        status: status === 'posted' ? 'posted' : 'draft',
        subtotal,
        taxTotal,
        total,
        paid: 0,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: { create: processedLines },
      },
      include: { lines: true, partner: true },
    })

    if (body.purchaseOrderId) {
      await db.purchaseOrder.update({
        where: { id: body.purchaseOrderId },
        data: { invoiceStatus: 'invoiced', status: 'billed' },
      })
    }

    if (status === 'posted') {
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'purchase',
        postingDate: body.accountingDate ? new Date(body.accountingDate) : new Date(),
        description: `فاتورة مشتريات ${code}`,
        refType: 'purchase_invoice',
        refId: invoice.id,
        currencyId: body.currencyId,
        lines: purchaseInvoicePosting({ total, subtotal, taxTotal, partnerId: body.partnerId }),
        userId: body.createdBy,
      })

      await db.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { journalEntryId: je.id, status: 'posted' },
      })

      // Update partner.currentBalance (increase AP — supplier owed)
      await db.partner.update({
        where: { id: body.partnerId },
        data: { currentBalance: { increment: total } },
      })
    }

    const result = await db.purchaseInvoice.findUnique({
      where: { id: invoice.id },
      include: { lines: { include: { product: true } }, partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
