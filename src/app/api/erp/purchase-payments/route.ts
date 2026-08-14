import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, paymentPosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/purchase-payments
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
    if (q) where.OR = [{ code: { contains: q } }, { reference: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.purchasePayment.findMany({
        where,
        skip,
        take: pageSize,
        include: { partner: { select: { id: true, nameAr: true, nameEn: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchasePayment.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — payment voucher (سند صرف). On post: post journal, decrease partner balance, update invoice.paid
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return badRequest('amount must be a positive number')

    const branchId = body.branchId ?? context.branchId
    const [company, partner] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: body.partnerId, companyId: context.companyId } }),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('partner not found')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null

    // Validate linked invoice belongs to company & partner
    const invoice = body.invoiceId
      ? await db.purchaseInvoice.findFirst({ where: { id: body.invoiceId, companyId: context.companyId } })
      : null
    if (body.invoiceId) {
      if (!invoice) return badRequest('invoice not found')
      if (invoice.partnerId !== body.partnerId) return badRequest('invoice does not belong to this partner')
    }

    const code = await nextNumber('purchase_payment', company.id, branch?.id)
    const status = body.status === 'draft' ? 'draft' : 'posted'
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date()

    const payment = await db.$transaction(async (tx) => {
      const pay = await tx.purchasePayment.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code,
          partnerId: body.partnerId,
          invoiceId: body.invoiceId,
          amount,
          paymentDate,
          method: body.method ?? 'cash',
          reference: body.reference,
          bankAccountId: body.bankAccountId,
          safeId: body.safeId,
          status,
          notes: body.notes,
          createdBy: context.userId,
        },
        include: { partner: true },
      })

      if (status === 'posted') {
        const je = await postJournalEntry({
          companyId: company.id,
          branchId: branch?.id,
          journalType: 'cash',
          postingDate: paymentDate,
          description: `سند صرف ${code}`,
          refType: 'purchase_payment',
          refId: pay.id,
          lines: paymentPosting({ amount, partnerId: body.partnerId }),
          userId: context.userId,
        }, tx)

        await tx.purchasePayment.update({
          where: { id: pay.id },
          data: { journalEntryId: je.id },
        })

        // Update partner.currentBalance (decrease AP)
        await tx.partner.update({
          where: { id: body.partnerId },
          data: { currentBalance: { decrement: amount } },
        })

        if (invoice) {
          const newPaid = invoice.paid + amount
          await tx.purchaseInvoice.update({
            where: { id: invoice.id },
            data: {
              paid: newPaid,
              status: newPaid + 0.01 >= invoice.total ? 'paid' : 'partially_paid',
            },
          })
        }
      }
      return pay
    })

    const result = await db.purchasePayment.findUnique({
      where: { id: payment.id },
      include: { partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
