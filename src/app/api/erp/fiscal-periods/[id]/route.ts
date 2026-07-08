import { db } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/erp/api-response'

// PUT /api/erp/fiscal-periods/[id] — close/lock period
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.fiscalPeriod.findUnique({ where: { id } })
    if (!exists) return notFound('Period not found')

    const updated = await db.fiscalPeriod.update({
      where: { id },
      data: {
        state: body.state ?? exists.state,
        closedAt: body.state === 'closed' ? new Date() : exists.closedAt,
        closedBy: body.closedBy ?? exists.closedBy,
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}
