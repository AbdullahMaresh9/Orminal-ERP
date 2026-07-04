import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''
    const where: any = {}
    if (status && status !== 'all') where.status = status

    const transfers = await db.stockTransfer.findMany({
      where,
      include: { fromStorehouse: true, toStorehouse: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: transfers, total: transfers.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.fromStorehouseId || !body.toStorehouseId) {
      return NextResponse.json({ error: 'from & to required' }, { status: 400 })
    }
    if (body.fromStorehouseId === body.toStorehouseId) {
      return NextResponse.json({ error: 'cannot transfer to same storehouse' }, { status: 400 })
    }
    const items: any[] = body.items ?? []
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

    const count = await db.stockTransfer.count()
    const code = `TRF-${String(count + 1).padStart(4, '0')}`

    const created = await db.stockTransfer.create({
      data: {
        code,
        fromStorehouseId: body.fromStorehouseId,
        toStorehouseId: body.toStorehouseId,
        status: body.status ?? 'draft',
        itemsJson: JSON.stringify(items),
        note: body.note || null,
      },
      include: { fromStorehouse: true, toStorehouse: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
