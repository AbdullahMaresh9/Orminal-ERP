import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cn = await db.salesCreditNote.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!cn) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(cn)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await db.salesCreditNote.update({
      where: { id },
      data: {
        reason: body.reason ?? null,
        note: body.note ?? null,
        status: body.status ?? 'posted',
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
    await db.journalEntry.deleteMany({ where: { refType: 'sales_credit_note', refId: id } })
    await db.salesCreditNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
