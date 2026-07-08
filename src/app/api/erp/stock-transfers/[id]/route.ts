import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Stock transfer not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update; allows status transition to 'done'
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.stockTransfer.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!exists) return notFound('Stock transfer not found')
    if (exists.status === 'done' || exists.status === 'cancelled')
      return badRequest('Cannot edit done or cancelled transfer')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body

    // If transitioning to done: process stock moves
    if (rest.status === 'done' && exists.status !== 'done') {
      await db.$transaction(async (tx) => {
        for (const l of exists.lines) {
          // Out of source
          await tx.stockMove.create({
            data: {
              companyId: exists.companyId,
              documentType: 'transfer',
              documentId: id,
              productId: l.productId,
              sourceWarehouseId: exists.fromWarehouseId,
              quantity: l.quantity,
              uomId: l.uomId,
              state: 'done',
              postingDate: new Date(),
            },
          })
          // Into dest
          await tx.stockMove.create({
            data: {
              companyId: exists.companyId,
              documentType: 'transfer',
              documentId: id,
              productId: l.productId,
              destWarehouseId: exists.toWarehouseId,
              quantity: l.quantity,
              uomId: l.uomId,
              state: 'done',
              postingDate: new Date(),
            },
          })

          // Decrement source
          const srcQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: exists.fromWarehouseId, locationId: null, lotId: null },
          })
          if (srcQuant) {
            await tx.stockQuant.update({
              where: { id: srcQuant.id },
              data: { quantity: { decrement: l.quantity } },
            })
          }

          // Increment dest
          const destQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: exists.toWarehouseId, locationId: null, lotId: null },
          })
          if (destQuant) {
            await tx.stockQuant.update({
              where: { id: destQuant.id },
              data: { quantity: { increment: l.quantity } },
            })
          } else {
            await tx.stockQuant.create({
              data: {
                productId: l.productId,
                warehouseId: exists.toWarehouseId,
                quantity: l.quantity,
              },
            })
          }
        }
        await tx.stockTransfer.update({ where: { id }, data: { status: 'done' } })
      })
      const updated = await db.stockTransfer.findUnique({
        where: { id },
        include: { lines: { include: { product: true } } },
      })
      return ok(updated)
    }

    const updated = await db.stockTransfer.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.stockTransfer.findUnique({ where: { id } })
    if (!exists) return notFound('Stock transfer not found')
    if (exists.status !== 'draft') return badRequest('Only draft transfers can be deleted')

    await db.stockTransfer.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
