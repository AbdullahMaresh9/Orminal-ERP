import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.warehouse.findUnique({
      where: { id },
      include: { branch: true },
    })
    if (!item) return notFound('Storehouse not found')
    
    const mapped = {
      ...item,
      name: item.nameAr,
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
    const exists = await db.warehouse.findUnique({ where: { id } })
    if (!exists) return notFound('Storehouse not found')

    const { id: _id, createdAt: _c, updatedAt: _u, name, nameAr, ...rest } = body
    const finalNameAr = name || nameAr || exists.nameAr

    const updated = await db.warehouse.update({
      where: { id },
      data: {
        ...rest,
        nameAr: finalNameAr,
      },
      include: { branch: true },
    })

    const mapped = {
      ...updated,
      name: updated.nameAr,
    }
    return ok(mapped)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.warehouse.findUnique({ where: { id } })
    if (!exists) return notFound('Storehouse not found')

    const stockCount = await db.stockQuant.count({ where: { warehouseId: id, quantity: { gt: 0 } } })
    if (stockCount > 0) return badRequest('Cannot delete: storehouse has stock')

    await db.warehouse.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
