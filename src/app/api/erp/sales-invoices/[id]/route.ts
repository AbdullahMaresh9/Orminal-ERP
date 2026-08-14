import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesInvoice.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Sales invoice not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesInvoice.findUnique({ where: { id } })
    if (!exists) return notFound('Sales invoice not found')
    // Posted invoices are immutable — corrections must go through a credit note.
    if (exists.status !== 'draft') return badRequest('Only draft invoices can be edited; use a credit note to correct a posted invoice')

    // Whitelist editable fields only — never allow totals, status, paid, journal, or scope to be overwritten here.
    const { notes, dueDate, paymentTermId, currencyId } = body
    const updated = await db.salesInvoice.update({
      where: { id },
      data: {
        notes,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        paymentTermId,
        currencyId,
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
