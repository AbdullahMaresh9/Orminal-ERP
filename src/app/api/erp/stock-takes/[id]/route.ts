import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const take = await db.stockTake.findUnique({ where: { id } })
    if (!take) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const storehouse = await db.storehouse.findUnique({ where: { id: take.storehouseId } })
    return NextResponse.json({ ...take, storehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.stockTake.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // If completing, apply adjustments (diff = counted - system)
    if (body.status === 'completed' && existing.status !== 'completed') {
      const items: any[] = body.items ? body.items : JSON.parse(existing.itemsJson || '[]')
      await db.$transaction(async (tx) => {
        for (const it of items) {
          const diff = Number(it.diff ?? (Number(it.countedQty) - Number(it.systemQty)))
          if (diff === 0) continue

          // Create adjustment movement
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              storehouseId: existing.storehouseId,
              type: 'adjustment',
              quantity: Math.abs(diff),
              refType: 'stock_take',
              refId: existing.id,
              note: `تسوية جرد (${diff > 0 ? '+' : ''}${diff})`,
            },
          })

          // Update stock item (find or create for storehouse+null batch)
          const si = await tx.stockItem.findFirst({
            where: { productId: it.productId, storehouseId: existing.storehouseId, batch: null },
          })
          if (si) {
            const newQty = Math.max(0, si.quantity + diff)
            await tx.stockItem.update({ where: { id: si.id }, data: { quantity: newQty } })
          } else if (diff > 0) {
            await tx.stockItem.create({
              data: {
                productId: it.productId,
                storehouseId: existing.storehouseId,
                quantity: diff,
              },
            })
          }
        }
        await tx.stockTake.update({
          where: { id },
          data: {
            status: 'completed',
            itemsJson: JSON.stringify(items),
            note: body.note ?? existing.note,
          },
        })
      })
      const updated = await db.stockTake.findUnique({ where: { id } })
      const storehouse = updated ? await db.storehouse.findUnique({ where: { id: updated.storehouseId } }) : null
      return NextResponse.json(updated ? { ...updated, storehouse } : null)
    }

    const updated = await db.stockTake.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        itemsJson: body.items ? JSON.stringify(body.items) : undefined,
        note: body.note ?? existing.note,
      },
    })
    const storehouse = await db.storehouse.findUnique({ where: { id: updated.storehouseId } })
    return NextResponse.json({ ...updated, storehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.stockTake.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
