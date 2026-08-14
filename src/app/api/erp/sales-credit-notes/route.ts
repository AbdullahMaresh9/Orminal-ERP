import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { reverseJournalEntry } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/sales-credit-notes
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
    if (q) where.OR = [{ code: { contains: q } }, { reason: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.salesCreditNote.findMany({
        where,
        skip,
        take: pageSize,
        include: { partner: { select: { id: true, nameAr: true, nameEn: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesCreditNote.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-credit-notes — create + reverse original invoice journal
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')

    const subtotal = Number(body.subtotal ?? 0)
    const taxTotal = Number(body.taxTotal ?? 0)
    const total = Number(body.total ?? 0)
    if (![subtotal, taxTotal, total].every((n) => Number.isFinite(n) && n >= 0)) {
      return badRequest('subtotal, taxTotal and total must be non-negative numbers')
    }

    const branchId = body.branchId ?? context.branchId
    const [company, partner] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: body.partnerId, companyId: context.companyId } }),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('partner not found')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null

    // Validate linked invoice (required for posting a reversal)
    const origInvoice = body.invoiceId
      ? await db.salesInvoice.findFirst({ where: { id: body.invoiceId, companyId: context.companyId } })
      : null
    if (body.invoiceId && !origInvoice) return badRequest('invoice not found')

    const status = body.status === 'posted' ? 'posted' : 'draft'
    if (status === 'posted') {
      if (!origInvoice) return badRequest('a linked invoice is required to post a credit note')
      if (!origInvoice.journalEntryId) return badRequest('linked invoice has no posted journal to reverse')
    }

    const code = await nextNumber('sales_credit_note', company.id, branch?.id)

    const cn = await db.$transaction(async (tx) => {
      const note = await tx.salesCreditNote.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code,
          partnerId: body.partnerId,
          invoiceId: body.invoiceId,
          date: body.date ? new Date(body.date) : new Date(),
          reason: body.reason,
          status,
          subtotal,
          taxTotal,
          total,
          notes: body.notes,
        },
        include: { partner: true },
      })

      if (status === 'posted' && origInvoice?.journalEntryId) {
        const reversal = await reverseJournalEntry(
          origInvoice.journalEntryId,
          context.userId,
          `إشعار دائن ${code}`,
          tx
        )
        await tx.salesCreditNote.update({
          where: { id: note.id },
          data: { journalEntryId: reversal.id },
        })
        // Update partner.currentBalance (decrease AR for credit note)
        await tx.partner.update({
          where: { id: body.partnerId },
          data: { currentBalance: { decrement: total } },
        })
      }
      return note
    })

    const result = await db.salesCreditNote.findUnique({
      where: { id: cn.id },
      include: { partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
