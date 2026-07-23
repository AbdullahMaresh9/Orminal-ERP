import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.goodsReceipt.findUnique({
      where: { id },
      include: {
        partner: true,
        warehouse: true,
        purchaseOrder: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Goods receipt not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.goodsReceipt.findUnique({ where: { id } })
    if (!exists) return notFound('Goods receipt not found')
    if (exists.status === 'validated' || exists.status === 'cancelled')
      return badRequest('Cannot edit validated or cancelled goods receipt')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.goodsReceipt.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.goodsReceipt.findUnique({ where: { id } })
    if (!exists) return notFound('Goods receipt not found')
    if (exists.status !== 'draft') return badRequest('Only draft goods receipts can be deleted')

    await db.goodsReceipt.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
