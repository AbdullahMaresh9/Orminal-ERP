import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const trf = await db.stockTransfer.findUnique({
      where: { id },
      include: { fromStorehouse: true, toStorehouse: true },
    })
    if (!trf) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(trf)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const trf = await db.stockTransfer.findUnique({ where: { id } })
    if (!trf) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const newStatus = body.status ?? trf.status

    // If transitioning to "received": actually move stock
    if (newStatus === 'received' && trf.status !== 'received') {
      const items: any[] = JSON.parse(trf.itemsJson || '[]')
      await db.$transaction(async (tx) => {
        // Decrement from source storehouse
        for (const it of items) {
          const qty = Number(it.quantity ?? 0)
          if (qty <= 0) continue
          // Movement out from source
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              storehouseId: trf.fromStorehouseId,
              type: 'transfer',
              quantity: qty,
              refType: 'transfer',
              refId: trf.id,
              note: `تحويل إلى ${trf.toStorehouseId}`,
            },
          })
          // Decrement source stock
          const sourceStock = await tx.stockItem.findFirst({
            where: { productId: it.productId, storehouseId: trf.fromStorehouseId, batch: null },
          })
          if (sourceStock) {
            await tx.stockItem.update({
              where: { id: sourceStock.id },
              data: { quantity: { decrement: qty } },
            })
          }

          // Movement in to target
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              storehouseId: trf.toStorehouseId,
              type: 'transfer',
              quantity: qty,
              refType: 'transfer',
              refId: trf.id,
              note: `تحويل من ${trf.fromStorehouseId}`,
            },
          })
          // Upsert target stock
          const targetStock = await tx.stockItem.findFirst({
            where: { productId: it.productId, storehouseId: trf.toStorehouseId, batch: null },
          })
          if (targetStock) {
            await tx.stockItem.update({
              where: { id: targetStock.id },
              data: { quantity: { increment: qty } },
            })
          } else {
            await tx.stockItem.create({
              data: {
                productId: it.productId,
                storehouseId: trf.toStorehouseId,
                quantity: qty,
              },
            })
          }
        }
        await tx.stockTransfer.update({ where: { id }, data: { status: 'received' } })
      })
      const updated = await db.stockTransfer.findUnique({
        where: { id },
        include: { fromStorehouse: true, toStorehouse: true },
      })
      return NextResponse.json(updated)
    }

    const updated = await db.stockTransfer.update({
      where: { id },
      data: {
        status: newStatus,
        itemsJson: body.items ? JSON.stringify(body.items) : undefined,
        note: body.note ?? undefined,
      },
      include: { fromStorehouse: true, toStorehouse: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.stockTransfer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
