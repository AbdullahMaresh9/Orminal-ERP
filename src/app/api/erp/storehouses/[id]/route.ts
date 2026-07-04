import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const wh = await db.storehouse.findUnique({
      where: { id },
      include: { branch: true, _count: { select: { stockItems: true } } },
    })
    if (!wh) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(wh)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await db.storehouse.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        branchId: body.branchId || null,
        address: body.address || null,
        active: body.active ?? true,
      },
      include: { branch: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.storehouse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
