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
      // Issue debit note: optionally reverse the original invoice journal, update partner balance
      if (exists.status === 'debited' || exists.status === 'closed')
        return badRequest('Return already debited')

      let journalEntryId: string | null = null

      // If an original invoice is linked, try to reverse its journal entry
      if (exists.originalInvoiceId) {
        const origInvoice = await db.purchaseInvoice.findUnique({ where: { id: exists.originalInvoiceId } })
        if (origInvoice?.journalEntryId) {
          const reversal = await reverseJournalEntry(
            origInvoice.journalEntryId,
            body.userId,
            `مرتجع مشتريات ${exists.code}`
          )
          journalEntryId = reversal.id
        }
      }

      await db.purchaseReturn.update({
        where: { id },
        data: { status: 'debited', ...(journalEntryId ? { journalEntryId } : {}) },
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

    // Default: simple field update (only allowed for draft status)
    if (exists.status !== 'draft') {
      return badRequest('لا يمكن تعديل المرتجع المرحّل أو المغلق أو الملغي. التعديل متاح للمسودات فقط.')
    }
    const { id: _id, lines, createdAt: _c, updatedAt: _u, status: _s, ...rest } = body

    // Convert date-only string (YYYY-MM-DD) to full ISO-8601 DateTime for Prisma
    if (rest.date && typeof rest.date === 'string' && rest.date.length === 10) {
      rest.date = new Date(rest.date + 'T00:00:00.000Z').toISOString()
    }

    const targetInvoiceId = rest.originalInvoiceId ?? exists.originalInvoiceId

    // Validate quantities if linked to an original invoice
    const validLines = Array.isArray(lines) ? lines.filter((l: any) => l.productId && Number(l.quantity) > 0) : []
    if (targetInvoiceId) {
      const invoiceLines = await db.purchaseInvoiceLine.findMany({
        where: { invoiceId: targetInvoiceId },
      })
      const invQtyMap = new Map<string, number>()
      for (const il of invoiceLines) {
        invQtyMap.set(il.productId, (invQtyMap.get(il.productId) ?? 0) + il.quantity)
      }
      for (const l of validLines) {
        const maxQty = invQtyMap.get(l.productId) ?? 0
        const retQty = Number(l.quantity) || 0
        if (maxQty > 0 && retQty > maxQty) {
          return badRequest(`الكمية المرجعة (${retQty}) تتجاوز الكمية المشتراة في الفاتورة الأصلية (${maxQty})`)
        }
      }
    }

    // Recalculate totals from lines
    let subtotal = 0, taxTotal = 0
    for (const l of validLines) {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
      const lineTax = lineSub * ((Number(l.taxRate) || 0) / 100)
      subtotal += lineSub
      taxTotal += lineTax
    }
    const total = subtotal + taxTotal

    const updated = await db.$transaction(async (tx) => {
      // Update main record fields + totals
      await tx.purchaseReturn.update({
        where: { id },
        data: { ...rest, subtotal, taxTotal, total },
      })

      // Replace lines: delete old, create new
      if (validLines.length > 0) {
        await tx.purchaseReturnLine.deleteMany({ where: { returnId: id } })
        await tx.purchaseReturnLine.createMany({
          data: validLines.map((l: any) => {
            const qty = Number(l.quantity) || 0
            const cost = Number(l.unitCost) || 0
            const tax = Number(l.taxRate) || 0
            return {
              returnId: id,
              productId: l.productId,
              quantity: qty,
              unitCost: cost,
              taxRate: tax,
              total: qty * cost * (1 + tax / 100),
            }
          }),
        })
      }

      return tx.purchaseReturn.findUnique({
        where: { id },
        include: { partner: true, lines: { include: { product: true } } },
      })
    })

    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — only draft (or cancelled if never posted)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseReturn.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase return not found')
    if (exists.status !== 'draft') {
      return badRequest('لا يمكن حذف المرتجع المرحّل أو المعالج لحماية القيود المحاسبية ورصيد المخزون وحساب المورد.')
    }

    await db.purchaseReturn.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
