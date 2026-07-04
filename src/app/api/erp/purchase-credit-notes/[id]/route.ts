import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const note = await db.purchaseCreditNote.findUnique({
      where: { id },
      include: { supplier: true },
    })
    if (!note) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(note)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.purchaseCreditNote.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const updated = await db.purchaseCreditNote.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        note: body.note ?? existing.note,
        reason: body.reason ?? existing.reason,
      },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.purchaseCreditNote.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    // Reverse supplier balance change
    await db.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: { increment: existing.total } },
    })

    await db.purchaseCreditNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
