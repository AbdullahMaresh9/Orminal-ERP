import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, phone: true, avatar: true,
        branchId: true, active: true, createdAt: true, updatedAt: true,
        branch: { select: { name: true } },
      },
    })
    if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: any = {
      name: body.name,
      email: body.email,
      role: body.role,
      phone: body.phone ?? null,
      branchId: body.branchId ?? null,
      active: body.active ?? true,
    }
    if (body.password) data.password = body.password
    if (body.avatar !== undefined) data.avatar = body.avatar
    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, phone: true, branchId: true, active: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
