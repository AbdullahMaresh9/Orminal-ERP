import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.warehouse.findUnique({
      where: { id },
      include: {
        branch: { include: { company: true } },
        locations: true,
        stockQuants: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
      },
    })
    if (!item) return notFound('Warehouse not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.warehouse.findUnique({ where: { id } })
    if (!exists) return notFound('Warehouse not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.warehouse.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.warehouse.findUnique({ where: { id } })
    if (!exists) return notFound('Warehouse not found')

    const stockCount = await db.stockQuant.count({ where: { warehouseId: id, quantity: { gt: 0 } } })
    if (stockCount > 0) return badRequest('Cannot delete: warehouse has stock')

    await db.warehouse.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
