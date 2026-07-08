import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.purchaseRequest.findUnique({
      where: { id },
      include: { lines: { include: { product: true, costCenter: true } } },
    })
    if (!item) return notFound('Purchase request not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.purchaseRequest.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase request not found')
    if (exists.status !== 'draft' && exists.status !== 'submitted')
      return badRequest('Cannot edit approved/rejected request')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.purchaseRequest.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.purchaseRequest.findUnique({ where: { id } })
    if (!exists) return notFound('Purchase request not found')
    if (exists.status !== 'draft') return badRequest('Only draft requests can be deleted')

    await db.purchaseRequest.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
