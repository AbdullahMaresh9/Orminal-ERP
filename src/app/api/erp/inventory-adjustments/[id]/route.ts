import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: true,
        reasonCode: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Inventory adjustment not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.inventoryAdjustment.findUnique({ where: { id } })
    if (!exists) return notFound('Inventory adjustment not found')
    if (exists.status === 'posted' || exists.status === 'cancelled')
      return badRequest('Cannot edit posted or cancelled adjustment')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.inventoryAdjustment.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.inventoryAdjustment.findUnique({ where: { id } })
    if (!exists) return notFound('Inventory adjustment not found')
    if (exists.status !== 'draft') return badRequest('Only draft adjustments can be deleted')

    await db.inventoryAdjustment.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
