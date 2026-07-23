import { db } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.revenue.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { id: true, nameAr: true, bankName: true } },
        safe: { select: { id: true, nameAr: true, code: true } },
      },
    })
    if (!item) return notFound('Revenue not found')

    const mapped = {
      ...item,
      bankAccount: item.bankAccount ? {
        id: item.bankAccount.id,
        name: item.bankAccount.nameAr,
        bankName: item.bankAccount.bankName,
      } : null,
      safe: item.safe ? {
        id: item.safe.id,
        name: item.safe.nameAr,
        code: item.safe.code,
      } : null,
    }

    return ok(mapped)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.revenue.findUnique({ where: { id } })
    if (!exists) return notFound('Revenue not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.revenue.update({
      where: { id },
      data: rest,
      include: {
        bankAccount: { select: { id: true, nameAr: true, bankName: true } },
        safe: { select: { id: true, nameAr: true, code: true } },
      },
    })

    const mapped = {
      ...updated,
      bankAccount: updated.bankAccount ? {
        id: updated.bankAccount.id,
        name: updated.bankAccount.nameAr,
        bankName: updated.bankAccount.bankName,
      } : null,
      safe: updated.safe ? {
        id: updated.safe.id,
        name: updated.safe.nameAr,
        code: updated.safe.code,
      } : null,
    }

    return ok(mapped)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.revenue.findUnique({ where: { id } })
    if (!exists) return notFound('Revenue not found')

    // If it was posted, we should deduct the safe/bank account balance back
    if (exists.status !== 'draft') {
      if (exists.bankAccountId) {
        await db.bankAccount.update({
          where: { id: exists.bankAccountId },
          data: { balance: { decrement: exists.amount } },
        })
      } else if (exists.safeId) {
        await db.safe.update({
          where: { id: exists.safeId },
          data: { balance: { decrement: exists.amount } },
        })
      }
    }

    await db.revenue.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
