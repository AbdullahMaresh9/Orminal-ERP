import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const storehouseId = searchParams.get('storehouseId') ?? ''
    const where: any = { type: 'out' }
    if (storehouseId && storehouseId !== 'all') where.storehouseId = storehouseId

    const movements = await db.stockMovement.findMany({
      where,
      include: { product: true, storehouse: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json({ data: movements, total: movements.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const storehouseId = body.storehouseId
    if (!storehouseId) return NextResponse.json({ error: 'storehouse required' }, { status: 400 })
    const items: any[] = body.items ?? []
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

    const created = await db.$transaction(async (tx) => {
      const movements = []
      for (const it of items) {
        const qty = Number(it.quantity ?? 0)
        if (qty <= 0) continue

        // Find existing stock for product+storehouse (any batch)
        const stockItems = await tx.stockItem.findMany({
          where: { productId: it.productId, storehouseId },
        })
        const available = stockItems.reduce((s, x) => s + x.quantity, 0)
        if (available < qty) {
          throw new Error(`الرصيد غير كافٍ للمنتج ${it.productId} (المتاح: ${available}, المطلوب: ${qty})`)
        }

        // Decrement from existing batches (FIFO by createdAt)
        let remaining = qty
        for (const si of stockItems.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
          if (remaining <= 0) break
          const take = Math.min(si.quantity, remaining)
          await tx.stockItem.update({
            where: { id: si.id },
            data: { quantity: { decrement: take } },
          })
          remaining -= take
        }

        const m = await tx.stockMovement.create({
          data: {
            productId: it.productId,
            storehouseId,
            type: 'out',
            quantity: qty,
            refType: body.refType ?? 'sales',
            refId: body.refId ?? null,
            note: body.note ?? null,
          },
          include: { product: true },
        })
        movements.push(m)
      }
      return movements
    })

    return NextResponse.json({ data: created, count: created.length }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
