import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, paymentPosting } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchasePayment.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!item) return notFound('Payment not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action, status } = body

    const payment = await db.purchasePayment.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!payment) return notFound('Payment not found')

    const targetAction = action || status

    if (targetAction === 'post' || targetAction === 'posted') {
      if (payment.status !== 'draft') return badRequest('Only draft payments can be posted')

      const je = await postJournalEntry({
        companyId: payment.companyId,
        branchId: payment.branchId ?? undefined,
        journalType: 'cash',
        postingDate: payment.paymentDate,
        description: `سند صرف ${payment.code}`,
        refType: 'purchase_payment',
        refId: payment.id,
        lines: paymentPosting({ amount: payment.amount, partnerId: payment.partnerId }),
      })

      // Update partner balance (decrease AP)
      await db.partner.update({
        where: { id: payment.partnerId },
        data: { currentBalance: { decrement: payment.amount } },
      })

      // Update invoice if linked
      if (payment.invoiceId) {
        const invoice = await db.purchaseInvoice.findUnique({ where: { id: payment.invoiceId } })
        if (invoice) {
          const newPaid = invoice.paid + payment.amount
          await db.purchaseInvoice.update({
            where: { id: payment.invoiceId },
            data: {
              paid: newPaid,
              status: newPaid >= invoice.total ? 'paid' : 'partially_paid',
            },
          })
        }
      }

      const updated = await db.purchasePayment.update({
        where: { id },
        data: { status: 'posted', journalEntryId: je.id },
        include: { partner: true },
      })
      return ok(updated)
    }

    if (targetAction === 'cancel' || targetAction === 'cancelled') {
      if (payment.status === 'cancelled') return badRequest('Payment is already cancelled')

      if (payment.status === 'posted') {
        // Revert partner balance
        await db.partner.update({
          where: { id: payment.partnerId },
          data: { currentBalance: { increment: payment.amount } },
        })

        // Revert invoice paid amount if linked
        if (payment.invoiceId) {
          const invoice = await db.purchaseInvoice.findUnique({ where: { id: payment.invoiceId } })
          if (invoice) {
            const newPaid = Math.max(0, invoice.paid - payment.amount)
            await db.purchaseInvoice.update({
              where: { id: payment.invoiceId },
              data: {
                paid: newPaid,
                status: newPaid <= 0 ? 'posted' : (newPaid >= invoice.total ? 'paid' : 'partially_paid'),
              },
            })
          }
        }
      }

      const updated = await db.purchasePayment.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { partner: true },
      })
      return ok(updated)
    }

    return badRequest('Invalid action')
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.purchasePayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft') return badRequest('Only draft payments can be edited')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.purchasePayment.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchasePayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft' && exists.status !== 'cancelled') {
      return badRequest('Only draft or cancelled payments can be deleted')
    }

    await db.purchasePayment.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}


