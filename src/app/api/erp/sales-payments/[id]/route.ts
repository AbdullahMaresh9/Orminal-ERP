import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, receiptPosting } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesPayment.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!item) return notFound('Payment not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesPayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft') return badRequest('Only draft payments can be edited')

    const amount = body.amount !== undefined ? Number(body.amount) : exists.amount
    const partnerId = body.partnerId ?? exists.partnerId
    const invoiceId = body.invoiceId !== undefined ? (body.invoiceId || null) : exists.invoiceId
    const targetStatus = body.status ?? exists.status

    let parsedDate = exists.paymentDate
    if (body.paymentDate) {
      const d = new Date(body.paymentDate)
      if (!isNaN(d.getTime())) {
        parsedDate = d
      }
    }

    // Status transition: draft -> posted
    if (targetStatus === 'posted') {
      const company = await db.company.findFirst()
      if (!company) return badRequest('no company in db')
      const branch = await db.branch.findFirst({ where: { companyId: company.id } })

      // Post to journal entry in ledger
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'cash',
        postingDate: parsedDate,
        description: `سند قبض ${exists.code}`,
        refType: 'sales_payment',
        refId: exists.id,
        lines: receiptPosting({ amount, partnerId }),
        userId: body.createdBy,
      })

      // Update partner receivable balance
      await db.partner.update({
        where: { id: partnerId },
        data: { currentBalance: { decrement: amount } },
      })

      // Update linked sales invoice
      if (invoiceId) {
        const invoice = await db.salesInvoice.findUnique({ where: { id: invoiceId } })
        if (invoice) {
          const newPaid = invoice.paid + amount
          await db.salesInvoice.update({
            where: { id: invoiceId },
            data: {
              paid: newPaid,
              status: newPaid >= invoice.total ? 'paid' : 'partially_paid',
            },
          })
        }
      }

      const updated = await db.salesPayment.update({
        where: { id },
        data: {
          partnerId,
          invoiceId,
          amount,
          paymentDate: parsedDate,
          method: body.method ?? exists.method,
          reference: body.reference ?? exists.reference,
          notes: body.notes ?? exists.notes,
          status: 'posted',
          journalEntryId: je.id,
        },
        include: { partner: true },
      })

      return ok(updated)
    }

    // Standard draft update
    const updated = await db.salesPayment.update({
      where: { id },
      data: {
        partnerId,
        invoiceId,
        amount,
        paymentDate: parsedDate,
        method: body.method ?? exists.method,
        reference: body.reference ?? exists.reference,
        notes: body.notes ?? exists.notes,
        status: 'draft',
      },
      include: { partner: true },
    })

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesPayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft') return badRequest('Only draft payments can be deleted')

    await db.salesPayment.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}

