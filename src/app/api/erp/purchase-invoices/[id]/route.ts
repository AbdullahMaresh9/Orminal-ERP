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
    if (exists.status !== 'draft') return badRequest('Only draft invoices can be edited; use a debit note to correct a posted invoice')

    // Whitelist editable fields only — never allow totals, status, paid, journal, or scope to be overwritten here.
    const { notes, dueDate, vendorBillNo, paymentTermId, currencyId } = body
    const updated = await db.purchaseInvoice.update({
      where: { id },
      data: {
        notes,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        vendorBillNo,
        paymentTermId,
        currencyId,
      },
    })
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
    if (invoice.paid > 0) return badRequest('Cannot reverse an invoice that has payments; reverse the payments first')

    const reversal = await db.$transaction(async (tx) => {
      const rev = await reverseJournalEntry(invoice.journalEntryId!, body.userId, `عكس فاتورة مشتريات ${invoice.code}`, tx)
      await tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'reversed' },
      })
      await tx.partner.update({
        where: { id: invoice.partnerId },
        data: { currentBalance: { decrement: invoice.total } },
      })
      return rev
    })

    return ok({ success: true, reversalEntryId: reversal.id, reversalCode: reversal.code })
  } catch (e: any) {
    return serverError(e.message)
  }
}
