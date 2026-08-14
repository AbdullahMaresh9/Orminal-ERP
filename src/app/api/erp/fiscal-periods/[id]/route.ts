import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError, unauthorized } from '@/lib/erp/api-response'
import { getRequestContext } from '@/lib/erp/context'

// PUT /api/erp/fiscal-periods/[id] — close/lock period
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { id } = await params
    const body = await req.json()
    const exists = await db.fiscalPeriod.findFirst({
      where: { id, fiscalYear: { companyId: context.companyId } },
    })
    if (!exists) return notFound('Period not found')

    const nextState = body.state ?? exists.state
    const isClosing = (nextState === 'closed' || nextState === 'locked') && exists.state === 'open'

    // A closed/locked period is immutable except for reopening it explicitly.
    if ((exists.state === 'closed' || exists.state === 'locked') && nextState === exists.state) {
      return badRequest('Period is already closed; reopen it before editing')
    }

    // Cannot close a period that still has unposted (draft) journal entries inside it.
    if (isClosing) {
      const draftCount = await db.journalEntry.count({
        where: {
          companyId: context.companyId,
          state: 'draft',
          postingDate: { gte: exists.startDate, lte: exists.endDate },
        },
      })
      if (draftCount > 0) {
        return badRequest(`Cannot close period: ${draftCount} draft entr${draftCount === 1 ? 'y' : 'ies'} must be posted or cancelled first`)
      }
    }

    // Dates/quarter can only change while the period is open.
    const canEditDates = exists.state === 'open'

    const updated = await db.fiscalPeriod.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : exists.name,
        startDate: canEditDates && body.startDate !== undefined ? new Date(body.startDate) : exists.startDate,
        endDate: canEditDates && body.endDate !== undefined ? new Date(body.endDate) : exists.endDate,
        quarter: canEditDates && body.quarter !== undefined ? body.quarter : exists.quarter,
        state: nextState,
        closedAt: isClosing ? new Date() : (nextState === 'open' ? null : exists.closedAt),
        closedBy: isClosing ? context.userId : (nextState === 'open' ? null : exists.closedBy),
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
