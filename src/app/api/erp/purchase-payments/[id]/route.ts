import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchasePayment.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!item) return notFound('Payment not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.purchasePayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft') return badRequest('Only draft payments can be edited')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.purchasePayment.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchasePayment.findUnique({ where: { id } })
    if (!exists) return notFound('Payment not found')
    if (exists.status !== 'draft') return badRequest('Only draft payments can be deleted')

    await db.purchasePayment.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
