import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, reverseJournalEntry } from '@/lib/erp/accounting-engine'
import { n } from '@/lib/erp/money'

// GET /api/erp/journal-entries/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.journalEntry.findUnique({
      where: { id },
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
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action

    const entry = await db.journalEntry.findUnique({
      where: { id },
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
        debit: n(l.debit),
        credit: n(l.credit),
        description: l.description ?? undefined,
        partnerId: l.partnerId ?? undefined,
        costCenterId: l.costCenterId ?? undefined,
        analyticAccountId: l.analyticAccountId ?? undefined,
        taxCodeId: l.taxCodeId ?? undefined,
      }))

      // Post via central engine (atomic)
      const posted = await postJournalEntry({
        companyId: entry.companyId,
        branchId: entry.branchId ?? undefined,
        journalType: 'general',
        postingDate: entry.postingDate,
        description: entry.description ?? 'Manual journal entry',
        refType: entry.refType ?? 'manual',
        refId: entry.refId ?? undefined,
        currencyId: entry.currencyId ?? undefined,
        lines,
        userId: body.userId,
      })

      // Reverse the draft lines (since postJournalEntry creates a new posted entry)
      await db.journalEntry.update({
        where: { id },
        data: { state: 'cancelled' },
      })

      const newEntry = await db.journalEntry.findUnique({
        where: { id: posted.id },
        include: { lines: { include: { account: true } } },
      })
      return ok(newEntry)
    }

    if (action === 'reverse') {
      if (entry.state !== 'posted') return badRequest('Only posted entries can be reversed')
      const reversal = await reverseJournalEntry(id, body.userId, body.reason)
      const reversed = await db.journalEntry.findUnique({
        where: { id: reversal.id },
        include: { lines: { include: { account: true } } },
      })
      return ok(reversed)
    }

    return badRequest('Unknown action. Use action=post or action=reverse')
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — only allow editing draft entries
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const entry = await db.journalEntry.findUnique({ where: { id } })
    if (!entry) return notFound('Journal entry not found')
    if (entry.state !== 'draft') return badRequest('Only draft entries can be edited')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.journalEntry.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
