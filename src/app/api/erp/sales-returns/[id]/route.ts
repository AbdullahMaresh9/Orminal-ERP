import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { reverseJournalEntry } from '@/lib/erp/accounting-engine'

// GET /api/erp/sales-returns/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesReturn.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Sales return not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update (only draft) OR action=approve|receive|credit|close|cancel
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action

    const exists = await db.salesReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Sales return not found')

    // Status-flow actions
    if (action === 'approve') {
      if (exists.status !== 'draft') return badRequest('Only draft returns can be approved')
      const updated = await db.salesReturn.update({ where: { id }, data: { status: 'approved' } })
      return ok(updated)
    }
    if (action === 'receive') {
      if (exists.status !== 'approved') return badRequest('Only approved returns can be received')
      const updated = await db.salesReturn.update({ where: { id }, data: { status: 'received' } })
      return ok(updated)
    }
    if (action === 'credit') {
      // Reverse the original invoice's journal entry, update partner balance
      if (exists.status === 'credited' || exists.status === 'closed')
        return badRequest('Return already credited')
      if (!exists.originalInvoiceId) return badRequest('No original invoice linked to credit')

      const origInvoice = await db.salesInvoice.findUnique({ where: { id: exists.originalInvoiceId } })
      if (!origInvoice) return badRequest('Original invoice not found')
      if (!origInvoice.journalEntryId) return badRequest('Original invoice has no journal entry to reverse')

      const reversal = await reverseJournalEntry(
        origInvoice.journalEntryId,
        body.userId,
        `مرتجع مبيعات ${exists.code}`
      )

      await db.salesReturn.update({
        where: { id },
        data: { status: 'credited', journalEntryId: reversal.id },
      })

      // Decrease AR (partner balance)
      await db.partner.update({
        where: { id: exists.partnerId },
        data: { currentBalance: { decrement: exists.total } },
      })

      const result = await db.salesReturn.findUnique({
        where: { id },
        include: { partner: true, lines: { include: { product: true } } },
      })
      return ok(result)
    }
    if (action === 'close') {
      if (exists.status !== 'credited') return badRequest('Only credited returns can be closed')
      const updated = await db.salesReturn.update({ where: { id }, data: { status: 'closed' } })
      return ok(updated)
    }
    if (action === 'cancel') {
      if (exists.status === 'credited' || exists.status === 'closed')
        return badRequest('Cannot cancel credited/closed returns')
      const updated = await db.salesReturn.update({ where: { id }, data: { status: 'cancelled' } })
      return ok(updated)
    }

    // Default: simple field update (only draft)
    if (exists.status !== 'draft') return badRequest('Only draft returns can be edited')
    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.salesReturn.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — only draft
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Sales return not found')
    if (exists.status !== 'draft' && exists.status !== 'cancelled')
      return badRequest('Only draft or cancelled returns can be deleted')

    await db.salesReturn.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
