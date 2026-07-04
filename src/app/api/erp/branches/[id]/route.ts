import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const branch = await db.branch.findUnique({ where: { id } })
    if (!branch) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(branch)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    if (body.isMain) {
      await db.branch.updateMany({ where: { isMain: true, NOT: { id } }, data: { isMain: false } })
    }
    const updated = await db.branch.update({
      where: { id },
      data: {
        name: body.name,
        address: body.address ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        taxNumber: body.taxNumber ?? null,
        isMain: body.isMain ?? false,
        active: body.active ?? true,
      },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const branch = await db.branch.findUnique({ where: { id } })
    if (branch?.isMain) {
      return NextResponse.json({ error: 'cannot delete main branch' }, { status: 400 })
    }
    await db.branch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
