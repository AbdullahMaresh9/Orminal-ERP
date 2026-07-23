import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { reverseJournalEntry } from '@/lib/erp/accounting-engine'

// GET /api/erp/sales-credit-notes
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = {}
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
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('sales_credit_note', company.id, branch?.id)

    const cn = await db.salesCreditNote.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        invoiceId: body.invoiceId,
        date: body.date ? new Date(body.date) : new Date(),
        reason: body.reason,
        status: body.status ?? 'draft',
        subtotal: body.subtotal ?? 0,
        taxTotal: body.taxTotal ?? 0,
        total: body.total ?? 0,
        notes: body.notes,
      },
      include: { partner: true },
    })

    // If invoiceId provided and status posted: reverse the original invoice's journal
    if (body.invoiceId && body.status === 'posted') {
      const origInvoice = await db.salesInvoice.findUnique({ where: { id: body.invoiceId } })
      if (origInvoice?.journalEntryId) {
        const reversal = await reverseJournalEntry(
          origInvoice.journalEntryId,
          body.userId,
          `إشعار دائن ${code}`
        )
        await db.salesCreditNote.update({
          where: { id: cn.id },
          data: { journalEntryId: reversal.id },
        })
        // Update partner.currentBalance (decrease AR for credit note)
        await db.partner.update({
          where: { id: body.partnerId },
          data: { currentBalance: { decrement: body.total ?? 0 } },
        })
      }
    }

    const result = await db.salesCreditNote.findUnique({
      where: { id: cn.id },
      include: { partner: true },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
