import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payment = await db.salesPayment.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!payment) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(payment)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await db.salesPayment.update({
      where: { id },
      data: {
        method: body.method,
        reference: body.reference ?? null,
        description: body.description ?? null,
        status: body.status ?? 'completed',
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
    await db.journalEntry.deleteMany({ where: { refType: 'sales_payment', refId: id } })
    await db.salesPayment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
