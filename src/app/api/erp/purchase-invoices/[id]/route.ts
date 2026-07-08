import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { reverseJournalEntry } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchaseInvoice.findUnique({
      where: { id },
      include: { partner: true, lines: { include: { product: true } } },
    })
    if (!item) return notFound('Purchase invoice not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.purchaseInvoice.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase invoice not found')
    if (exists.status !== 'draft') return badRequest('Only draft invoices can be edited')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.purchaseInvoice.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseInvoice.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase invoice not found')
    if (exists.status !== 'draft') return badRequest('Only draft invoices can be deleted')

    await db.purchaseInvoice.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action
    if (action !== 'reverse') return badRequest('Use action=reverse')

    const invoice = await db.purchaseInvoice.findUnique({ where: { id } })
    if (!invoice) return notFound('Purchase invoice not found')
    if (invoice.status !== 'posted') return badRequest('Only posted invoices can be reversed')
    if (!invoice.journalEntryId) return badRequest('No journal entry to reverse')

    const reversal = await reverseJournalEntry(invoice.journalEntryId, body.userId, `عكس فاتورة مشتريات ${invoice.code}`)

    await db.purchaseInvoice.update({
      where: { id },
      data: { status: 'reversed' },
    })
    await db.partner.update({
      where: { id: invoice.partnerId },
      data: { currentBalance: { decrement: invoice.total } },
    })

    return ok({ success: true, reversalEntryId: reversal.id, reversalCode: reversal.code })
  } catch (e: any) {
    return serverError(e.message)
  }
}
