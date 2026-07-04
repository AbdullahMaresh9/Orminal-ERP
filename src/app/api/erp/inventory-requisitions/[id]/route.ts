import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const req = await db.inventoryRequisition.findUnique({ where: { id } })
    if (!req) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const storehouse = await db.storehouse.findUnique({ where: { id: req.storehouseId } })
    return NextResponse.json({ ...req, storehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.inventoryRequisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // If fulfilling: actually decrement stock
    if (body.status === 'fulfilled' && existing.status !== 'fulfilled') {
      const items: any[] = body.items ? body.items : JSON.parse(existing.itemsJson || '[]')
      await db.$transaction(async (tx) => {
        for (const it of items) {
          const qty = Number(it.quantity ?? 0)
          if (qty <= 0) continue
          const stockItems = await tx.stockItem.findMany({
            where: { productId: it.productId, storehouseId: existing.storehouseId },
          })
          const available = stockItems.reduce((s, x) => s + x.quantity, 0)
          if (available < qty) {
            throw new Error(`الرصيد غير كافٍ للمنتج (${it.productId})`)
          }
          let remaining = qty
          for (const si of stockItems.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
            if (remaining <= 0) break
            const take = Math.min(si.quantity, remaining)
            await tx.stockItem.update({ where: { id: si.id }, data: { quantity: { decrement: take } } })
            remaining -= take
          }
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              storehouseId: existing.storehouseId,
              type: 'out',
              quantity: qty,
              refType: 'requisition',
              refId: existing.id,
              note: `صرف بناءً على طلب ${existing.code}`,
            },
          })
        }
        await tx.inventoryRequisition.update({
          where: { id },
          data: {
            status: 'fulfilled',
            itemsJson: JSON.stringify(items),
            note: body.note ?? existing.note,
          },
        })
      })
      const updated = await db.inventoryRequisition.findUnique({ where: { id } })
      const storehouse = updated ? await db.storehouse.findUnique({ where: { id: updated.storehouseId } }) : null
      return NextResponse.json(updated ? { ...updated, storehouse } : null)
    }

    const updated = await db.inventoryRequisition.update({
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
    await db.inventoryRequisition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
