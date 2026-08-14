import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.account.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    })
    if (!item) return notFound('Account not found')

    const lines = await db.journalLine.aggregate({
      where: { accountId: id },
      _sum: { debit: true, credit: true },
    })
    const isDebitNormal = item.type === 'asset' || item.type === 'expense'
    const computedBalance = isDebitNormal
      ? (lines._sum.debit ?? 0) - (lines._sum.credit ?? 0)
      : (lines._sum.credit ?? 0) - (lines._sum.debit ?? 0)

    return ok({ ...item, computedBalance, sumDebit: lines._sum.debit ?? 0, sumCredit: lines._sum.credit ?? 0 })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.account.findUnique({ where: { id } })
    if (!exists) return notFound('Account not found')

    // System accounts: only allow name updates
    if (exists.isSystem) {
      const updated = await db.account.update({
        where: { id },
        data: { nameAr: body.nameAr ?? exists.nameAr, nameEn: body.nameEn ?? exists.nameEn, active: body.active ?? exists.active },
      })
      return ok(updated)
    }

    // If the account already carries journal lines, its code/type/normal-side is
    // frozen — changing them would silently corrupt the trial balance.
    const lineCount = await db.journalLine.count({ where: { accountId: id } })
    const locked = lineCount > 0

    const data: any = {
      nameAr: body.nameAr ?? exists.nameAr,
      nameEn: body.nameEn ?? exists.nameEn,
      active: body.active ?? exists.active,
    }
    if (!locked) {
      if (body.code !== undefined) data.code = body.code
      if (body.type !== undefined) data.type = body.type
      if (body.subtype !== undefined) data.subtype = body.subtype
      if (body.parentId !== undefined) data.parentId = body.parentId
    } else if (
      (body.code !== undefined && body.code !== exists.code) ||
      (body.type !== undefined && body.type !== exists.type)
    ) {
      return badRequest('Cannot change code or type of an account that already has journal entries')
    }

    const updated = await db.account.update({ where: { id }, data })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.account.findUnique({ where: { id } })
    if (!exists) return notFound('Account not found')

    // Block DELETE on system accounts
    if (exists.isSystem) return badRequest('Cannot delete system account')

    // Block if has journal lines
    const lineCount = await db.journalLine.count({ where: { accountId: id } })
    if (lineCount > 0) return badRequest('Cannot delete: account has journal entries')

    // Block if has children
    const childrenCount = await db.account.count({ where: { parentId: id } })
    if (childrenCount > 0) return badRequest('Cannot delete: account has sub-accounts')

    await db.account.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
