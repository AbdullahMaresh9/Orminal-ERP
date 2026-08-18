import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { n } from '@/lib/erp/money'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.safe.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, code: true, nameAr: true } },
      },
    })
    if (!item) return notFound('Safe not found')

    // Build a mini statement from journal lines touching the linked GL account
    let transactions: any[] = []
    if (item.accountId) {
      const lines = await db.journalLine.findMany({
        where: { accountId: item.accountId },
        include: {
          entry: {
            select: {
              id: true, code: true, postingDate: true, description: true, state: true,
            },
          },
        },
        orderBy: { entry: { postingDate: 'desc' } },
        take: 50,
      })
      transactions = lines.map((l) => ({
        code: l.entry?.code,
        date: l.entry?.postingDate,
        description: l.entry?.description,
        debit: l.debit,
        credit: l.credit,
        posted: l.entry?.state === 'posted',
      }))
    }
    return ok({ ...item, transactions })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.safe.findUnique({ where: { id } })
    if (!exists) return notFound('Safe not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.safe.update({
      where: { id },
      data: rest,
      include: {
        account: { select: { id: true, code: true, nameAr: true } },
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
    const exists = await db.safe.findUnique({ where: { id } })
    if (!exists) return notFound('Safe not found')

    if (Math.abs(n(exists.balance)) > 0.001) {
      return badRequest('Cannot delete: safe has non-zero balance. Settle balance first.')
    }

    await db.safe.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
