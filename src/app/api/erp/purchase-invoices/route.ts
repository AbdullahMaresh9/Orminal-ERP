import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, purchaseInvoicePosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/purchase-invoices
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

    if (body.purchaseOrderId) {
      const po = await db.purchaseOrder.findFirst({ where: { id: body.purchaseOrderId, companyId: context.companyId } })
      if (!po) return badRequest('purchase order not found')
    }

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

    const status = body.status === 'draft' ? 'draft' : 'posted'
    const accountingDate = body.accountingDate ? new Date(body.accountingDate) : new Date()

    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.purchaseInvoice.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code,
          partnerId: body.partnerId,
          purchaseOrderId: body.purchaseOrderId,
          billDate: body.billDate ? new Date(body.billDate) : new Date(),
          accountingDate,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          vendorBillNo: body.vendorBillNo,
          currencyId: body.currencyId,
          paymentTermId: body.paymentTermId,
          status,
          subtotal,
          taxTotal,
          total,
          paid: 0,
          notes: body.notes,
          createdBy: context.userId,
          lines: { create: processedLines },
        },
        include: { lines: true, partner: true },
      })

      if (body.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: body.purchaseOrderId },
          data: { invoiceStatus: 'invoiced', status: 'billed' },
        })
      }

      if (status === 'posted') {
        const je = await postJournalEntry({
          companyId: company.id,
          branchId: branch?.id,
          journalType: 'purchase',
          postingDate: accountingDate,
          description: `فاتورة مشتريات ${code}`,
          refType: 'purchase_invoice',
          refId: inv.id,
          currencyId: body.currencyId,
          lines: purchaseInvoicePosting({ total, subtotal, taxTotal, partnerId: body.partnerId }),
          userId: context.userId,
        }, tx)

        await tx.purchaseInvoice.update({
          where: { id: inv.id },
          data: { journalEntryId: je.id },
        })

        // Update partner.currentBalance (increase AP — supplier owed)
        await tx.partner.update({
          where: { id: body.partnerId },
          data: { currentBalance: { increment: total } },
        })
      }
      return inv
    })

    const result = await db.purchaseInvoice.findUnique({
      where: { id: invoice.id },
      include: { lines: { include: { product: true } }, partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
