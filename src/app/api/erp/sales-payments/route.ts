import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, receiptPosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/sales-payments
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
    if (q) where.OR = [{ code: { contains: q } }, { reference: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.salesPayment.findMany({
        where,
        skip,
        take: pageSize,
        include: { partner: { select: { id: true, nameAr: true, nameEn: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesPayment.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-payments — receipt voucher (سند قبض)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (body.amount === undefined || body.amount === null) return badRequest('amount is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('sales_payment', company.id, branch?.id)
    const status = body.status ?? 'posted'
    const amount = Number(body.amount)

    const payment = await db.salesPayment.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        invoiceId: body.invoiceId,
        amount,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        method: body.method ?? 'cash',
        reference: body.reference,
        bankAccountId: body.bankAccountId,
        safeId: body.safeId,
        status: status === 'posted' ? 'posted' : 'draft',
        notes: body.notes,
        createdBy: body.createdBy,
      },
      include: { partner: true },
    })

    // If posted: post journal entry, update partner balance, update linked invoice.paid
    if (status === 'posted') {
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'cash',
        postingDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        description: `سند قبض ${code}`,
        refType: 'sales_payment',
        refId: payment.id,
        lines: receiptPosting({ amount, partnerId: body.partnerId }),
        userId: body.createdBy,
      })

      await db.salesPayment.update({
        where: { id: payment.id },
        data: { journalEntryId: je.id, status: 'posted' },
      })

      // Update partner.currentBalance (decrease AR)
      await db.partner.update({
        where: { id: body.partnerId },
        data: { currentBalance: { decrement: amount } },
      })

      // Update linked invoice.paid
      if (body.invoiceId) {
        const invoice = await db.salesInvoice.findUnique({ where: { id: body.invoiceId } })
        if (invoice) {
          const newPaid = invoice.paid + amount
          await db.salesInvoice.update({
            where: { id: body.invoiceId },
            data: {
              paid: newPaid,
              status: newPaid >= invoice.total ? 'paid' : 'partially_paid',
            },
          })
        }
      }
    }

    const result = await db.salesPayment.findUnique({
      where: { id: payment.id },
      include: { partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
