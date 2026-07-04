import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''
    const storehouseId = searchParams.get('storehouseId') ?? ''
    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (storehouseId && storehouseId !== 'all') where.storehouseId = storehouseId

    const takes = await db.stockTake.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    // Enrich with storehouse info (no relation in schema)
    const storehouseIds = [...new Set(takes.map(t => t.storehouseId))]
    const storehouses = storehouseIds.length
      ? await db.storehouse.findMany({ where: { id: { in: storehouseIds } } })
      : []
    const sm = new Map(storehouses.map(s => [s.id, s]))
    const data = takes.map(t => ({ ...t, storehouse: sm.get(t.storehouseId) ?? null }))
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.storehouseId) return NextResponse.json({ error: 'storehouse required' }, { status: 400 })

    // Auto-load current stock items for counting
    const stockItems = await db.stockItem.findMany({
      where: { storehouseId: body.storehouseId },
      include: { product: true },
    })
    const items = stockItems.map(si => ({
      productId: si.productId,
      productName: si.product.name,
      systemQty: si.quantity,
      countedQty: si.quantity,
      diff: 0,
    }))

    const count = await db.stockTake.count()
    const code = `STK-${String(count + 1).padStart(4, '0')}`

    const created = await db.stockTake.create({
      data: {
        code,
        storehouseId: body.storehouseId,
        status: body.status ?? 'draft',
        note: body.note || null,
        itemsJson: JSON.stringify(items),
      },
    })
    // Enrich with storehouse
    const storehouse = await db.storehouse.findUnique({ where: { id: body.storehouseId } })
    return NextResponse.json({ ...created, storehouse }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
