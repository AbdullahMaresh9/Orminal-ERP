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

    const reqs = await db.inventoryRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    // Enrich with storehouse info (no relation in schema)
    const storehouseIds = [...new Set(reqs.map(r => r.storehouseId))]
    const storehouses = storehouseIds.length
      ? await db.storehouse.findMany({ where: { id: { in: storehouseIds } } })
      : []
    const sm = new Map(storehouses.map(s => [s.id, s]))
    const data = reqs.map(r => ({ ...r, storehouse: sm.get(r.storehouseId) ?? null }))
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.storehouseId) return NextResponse.json({ error: 'storehouse required' }, { status: 400 })
    const items: any[] = body.items ?? []
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

    const count = await db.inventoryRequisition.count()
    const code = `REQ-${String(count + 1).padStart(4, '0')}`

    const created = await db.inventoryRequisition.create({
      data: {
        code,
        storehouseId: body.storehouseId,
        status: body.status ?? 'draft',
        itemsJson: JSON.stringify(items),
        note: body.note || null,
        requesterId: body.requesterId || null,
      },
    })
    const storehouse = await db.storehouse.findUnique({ where: { id: body.storehouseId } })
    return NextResponse.json({ ...created, storehouse }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
