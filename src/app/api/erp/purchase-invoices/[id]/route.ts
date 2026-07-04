import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await db.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        items: { include: { product: true } },
      },
    })
    if (!invoice) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(invoice)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.purchaseInvoice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const oldPaid = existing.paid
    const newPaid = body.paid !== undefined ? Number(body.paid) : oldPaid
    const paidDelta = newPaid - oldPaid

    const updated = await db.purchaseInvoice.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        note: body.note ?? existing.note,
        paid: newPaid,
      },
    })

    // If paid changed, update supplier balance (reduces AP)
    if (paidDelta !== 0) {
      await db.supplier.update({
        where: { id: existing.supplierId },
        data: { balance: { decrement: paidDelta } },
      })
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.purchaseInvoice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    // Reverse supplier balance
    await db.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: { decrement: existing.total - existing.paid } },
    })

    await db.purchaseInvoice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
