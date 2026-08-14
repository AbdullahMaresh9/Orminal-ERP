import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError, unauthorized } from '@/lib/erp/api-response'
import { postJournalEntry, reverseJournalEntry } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/journal-entries/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const item = await db.journalEntry.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        journal: true,
        lines: {
          include: {
            account: true,
            partner: { select: { id: true, nameAr: true } },
            costCenter: true,
            analyticAccount: true,
            taxCode: true,
          },
        },
      },
    })
    if (!item) return notFound('Journal entry not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/journal-entries/[id] — actions: post | reverse
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action

    const entry = await db.journalEntry.findFirst({
      where: { id, companyId: context.companyId },
      include: { lines: true },
    })
    if (!entry) return notFound('Journal entry not found')

    if (action === 'post') {
      if (entry.state !== 'draft') return badRequest('Only draft entries can be posted')

      // Build lines for posting engine
      const accountIds = entry.lines.map((l) => l.accountId)
      const accounts = await db.account.findMany({ where: { id: { in: accountIds } } })
      const accountMap = new Map(accounts.map((a) => [a.id, a.code]))

      const lines = entry.lines.map((l) => ({
        accountCode: accountMap.get(l.accountId)!,
        debit: l.debit,
        credit: l.credit,
        description: l.description ?? undefined,
        partnerId: l.partnerId ?? undefined,
        costCenterId: l.costCenterId ?? undefined,
        analyticAccountId: l.analyticAccountId ?? undefined,
        taxCodeId: l.taxCodeId ?? undefined,
      }))

      // Post the new entry AND cancel the draft in one transaction so we never
      // end up with a duplicate posted entry while the draft stays open.
      const posted = await db.$transaction(async (tx) => {
        const p = await postJournalEntry({
          companyId: entry.companyId,
          branchId: entry.branchId ?? undefined,
          journalType: 'general',
          postingDate: entry.postingDate,
          description: entry.description ?? 'Manual journal entry',
          refType: entry.refType ?? 'manual',
          refId: entry.refId ?? undefined,
          currencyId: entry.currencyId ?? undefined,
          lines,
          userId: context.userId,
        }, tx)
        await tx.journalEntry.update({ where: { id }, data: { state: 'cancelled' } })
        return p
      })

      const newEntry = await db.journalEntry.findUnique({
        where: { id: posted.id },
        include: { lines: { include: { account: true } } },
      })
      return ok(newEntry)
    }

    if (action === 'reverse') {
      if (entry.state !== 'posted') return badRequest('Only posted entries can be reversed')
      const reversal = await db.$transaction((tx) =>
        reverseJournalEntry(id, context.userId, body.reason, tx)
      )
      const reversed = await db.journalEntry.findUnique({
        where: { id: reversal.id },
        include: { lines: { include: { account: true } } },
      })
      return ok(reversed)
    }

    return badRequest('Unknown action. Use action=post or action=reverse')
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.startsWith('PERIOD_CLOSED')) {
      return badRequest('The accounting period for this date is closed')
    }
    return serverError(e.message)
  }
}

// PUT — only allow editing draft entries
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json()
    const entry = await db.journalEntry.findFirst({ where: { id, companyId: context.companyId } })
    if (!entry) return notFound('Journal entry not found')
    if (entry.state !== 'draft') return badRequest('Only draft entries can be edited')

    // Whitelist descriptive fields only — never let state, totals, or scope be overwritten here.
    const { description, reference, postingDate } = body
    const updated = await db.journalEntry.update({
      where: { id },
      data: {
        description,
        reference,
        postingDate: postingDate ? new Date(postingDate) : undefined,
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
