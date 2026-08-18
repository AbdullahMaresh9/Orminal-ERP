import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, SYSTEM_ACCOUNTS, JournalLineInput } from '@/lib/erp/accounting-engine'

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
      // Issue a dedicated Credit Note & journal entry for the return
      if (exists.status === 'credited' || exists.status === 'closed') {
        return badRequest('Return already credited')
      }

      const company = await db.company.findFirst()
      if (!company) return badRequest('no company in db')
      const branch = await db.branch.findFirst({ where: { companyId: company.id } })

      // Construct Credit Note journal entry lines:
      // Debit: Sales Returns (4200) -> subtotal
      // Debit: Output VAT (2100) -> taxTotal
      // Credit: AR Customer (1100) -> total
      const creditNoteLines: JournalLineInput[] = []

      if (exists.subtotal > 0) {
        creditNoteLines.push({
          accountCode: SYSTEM_ACCOUNTS.SALES_RETURNS, // '4200'
          debit: exists.subtotal,
          credit: 0,
          description: `مردودات مبيعات - مرتجع ${exists.code}`,
        })
      }

      if (exists.taxTotal > 0) {
        creditNoteLines.push({
          accountCode: SYSTEM_ACCOUNTS.OUTPUT_VAT, // '2100'
          debit: exists.taxTotal,
          credit: 0,
          description: `تخفيض ضريبة القيمة المضافة لمرتجع ${exists.code}`,
        })
      }

      creditNoteLines.push({
        accountCode: SYSTEM_ACCOUNTS.AR, // '1100'
        debit: 0,
        credit: exists.total,
        partnerId: exists.partnerId,
        description: `تسوية حساب العميل لمرتجع المبيعات ${exists.code}`,
      })

      const journalEntry = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'sale',
        postingDate: new Date(),
        description: `إشعار دائن لمرتجع مبيعات ${exists.code}`,
        refType: 'sales_return_credit',
        refId: exists.id,
        lines: creditNoteLines,
        userId: body.userId,
      })

      // Generate Credit Note Code CN-YYYY-NNNNN
      const year = new Date().getFullYear()
      const countCN = await db.salesCreditNote.count({ where: { companyId: company.id } })
      let seqCN = countCN + 1
      let cnCode = `CN-${year}-${String(seqCN).padStart(5, '0')}`
      while (await db.salesCreditNote.findUnique({ where: { code: cnCode } })) {
        seqCN += 1
        cnCode = `CN-${year}-${String(seqCN).padStart(5, '0')}`
      }

      // Save formal Sales Credit Note record
      const creditNote = await db.salesCreditNote.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code: cnCode,
          partnerId: exists.partnerId,
          invoiceId: exists.originalInvoiceId || null,
          date: new Date(),
          reason: exists.reason || `إشعار دائن لمرتجع مبيعات ${exists.code}`,
          status: 'posted',
          subtotal: exists.subtotal,
          taxTotal: exists.taxTotal,
          total: exists.total,
          journalEntryId: journalEntry.id,
          notes: `تم الإصدار آلياً عبر مرتجع المبيعات ${exists.code}`,
        },
      })

      // Update Sales Return status
      await db.salesReturn.update({
        where: { id },
        data: { status: 'credited', journalEntryId: journalEntry.id },
      })

      // Decrease customer receivable balance (decrement AR)
      await db.partner.update({
        where: { id: exists.partnerId },
        data: { currentBalance: { decrement: exists.total } },
      })

      const result = await db.salesReturn.findUnique({
        where: { id },
        include: { partner: true, lines: { include: { product: true } } },
      })
      return ok({ ...result, creditNote })
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
