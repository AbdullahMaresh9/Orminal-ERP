import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const client = await db.client.findUnique({
      where: { id },
      include: {
        salesOrders: { orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { items: true } } } },
        salesInvoices: { orderBy: { createdAt: 'desc' }, take: 100 },
        salesPayments: { orderBy: { date: 'desc' }, take: 100 },
        salesCreditNotes: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    })
    if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(client)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Compute new balance if openingBalance changes (balance = openingBalance + adjustments from invoices/payments)
    const prev = await db.client.findUnique({ where: { id } })
    const prevOpening = prev?.openingBalance ?? 0
    const newOpening = Number(body.openingBalance ?? 0)
    const openingDiff = newOpening - prevOpening

    const updated = await db.client.update({
      where: { id },
      data: {
        name: body.name,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        taxNumber: body.taxNumber ?? null,
        openingBalance: newOpening,
        balance: (prev?.balance ?? 0) + openingDiff,
        creditLimit: Number(body.creditLimit ?? 0),
        active: body.active ?? true,
      },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('client PUT error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.client.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
