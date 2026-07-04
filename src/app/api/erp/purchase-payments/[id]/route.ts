import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payment = await db.purchasePayment.findUnique({
      where: { id },
      include: { supplier: true },
    })
    if (!payment) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(payment)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.purchasePayment.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const updated = await db.purchasePayment.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        description: body.description ?? existing.description,
        reference: body.reference ?? existing.reference,
        method: body.method ?? existing.method,
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
    const existing = await db.purchasePayment.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    // Reverse supplier balance change
    await db.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: { increment: existing.amount } },
    })

    // If linked invoice, reduce its paid amount
    if (existing.invoiceId) {
      const inv = await db.purchaseInvoice.findUnique({ where: { id: existing.invoiceId } })
      if (inv) {
        const newPaid = Math.max(0, inv.paid - existing.amount)
        await db.purchaseInvoice.update({
          where: { id: inv.id },
          data: { paid: newPaid, status: newPaid >= inv.total ? 'paid' : 'posted' },
        })
      }
    }

    await db.purchasePayment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
