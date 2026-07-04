import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [data, total] = await Promise.all([
      db.branch.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, salesOrders: true, purchaseOrders: true } } },
      }),
      db.branch.count(),
    ])
    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.branch.count()
    const code = body.code ?? `BRA-${String(count + 1).padStart(4, '0')}`

    // If this is the main branch, unset others
    if (body.isMain) {
      await db.branch.updateMany({ where: { isMain: true }, data: { isMain: false } })
    }

    const created = await db.branch.create({
      data: {
        code,
        name: body.name,
        address: body.address ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        taxNumber: body.taxNumber ?? null,
        isMain: body.isMain ?? false,
        active: body.active ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
