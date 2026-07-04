import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const branchId = searchParams.get('branchId') ?? ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { address: { contains: q } },
      ]
    }
    if (branchId && branchId !== 'all') where.branchId = branchId

    const storehouses = await db.storehouse.findMany({
      where,
      include: {
        branch: true,
        _count: { select: { stockItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: storehouses, total: storehouses.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.storehouse.count()
    const code = body.code?.trim() || `WH-${String(count + 1).padStart(3, '0')}`
    const created = await db.storehouse.create({
      data: {
        name: body.name,
        code,
        branchId: body.branchId || null,
        address: body.address || null,
        active: body.active ?? true,
      },
      include: { branch: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
