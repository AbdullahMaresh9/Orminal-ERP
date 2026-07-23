import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { reverseJournalEntry } from '@/lib/erp/accounting-engine'

// GET /api/erp/purchase-returns/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Purchase return not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update (only draft) OR action=approve|ship|debit|close|cancel
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action

    const exists = await db.purchaseReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase return not found')

    if (action === 'approve') {
      if (exists.status !== 'draft') return badRequest('Only draft returns can be approved')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'approved' } })
      return ok(updated)
    }
    if (action === 'ship') {
      if (exists.status !== 'approved') return badRequest('Only approved returns can be shipped')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'shipped' } })
      return ok(updated)
    }
    if (action === 'debit') {
      // Reverse the original purchase invoice's journal entry, update partner balance
      if (exists.status === 'debited' || exists.status === 'closed')
        return badRequest('Return already debited')
      if (!exists.originalInvoiceId) return badRequest('No original invoice linked to debit')

      const origInvoice = await db.purchaseInvoice.findUnique({ where: { id: exists.originalInvoiceId } })
      if (!origInvoice) return badRequest('Original invoice not found')
      if (!origInvoice.journalEntryId) return badRequest('Original invoice has no journal entry to reverse')

      const reversal = await reverseJournalEntry(
        origInvoice.journalEntryId,
        body.userId,
        `مرتجع مشتريات ${exists.code}`
      )

      await db.purchaseReturn.update({
        where: { id },
        data: { status: 'debited', journalEntryId: reversal.id },
      })

      // Decrease AP (partner balance — supplier is owed less)
      await db.partner.update({
        where: { id: exists.partnerId },
        data: { currentBalance: { decrement: exists.total } },
      })

      const result = await db.purchaseReturn.findUnique({
        where: { id },
        include: { partner: true, lines: { include: { product: true } } },
      })
      return ok(result)
    }
    if (action === 'close') {
      if (exists.status !== 'debited') return badRequest('Only debited returns can be closed')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'closed' } })
      return ok(updated)
    }
    if (action === 'cancel') {
      if (exists.status === 'debited' || exists.status === 'closed')
        return badRequest('Cannot cancel debited/closed returns')
      const updated = await db.purchaseReturn.update({ where: { id }, data: { status: 'cancelled' } })
      return ok(updated)
    }

    // Default: simple field update (only draft)
    if (exists.status !== 'draft') return badRequest('Only draft returns can be edited')
    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.purchaseReturn.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — only draft or cancelled
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase return not found')
    if (exists.status !== 'draft' && exists.status !== 'cancelled')
      return badRequest('Only draft or cancelled returns can be deleted')

    await db.purchaseReturn.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
