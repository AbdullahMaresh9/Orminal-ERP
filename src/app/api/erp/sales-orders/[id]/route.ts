import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await db.salesOrder.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    })
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(order)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const items = (body.items ?? []).filter((it: any) => it.productId && Number(it.quantity) > 0)
    let subtotal = 0
    let taxTotal = 0
    const computedItems = items.map((it: any) => {
      const qty = Number(it.quantity) || 0
      const unitPrice = Number(it.unitPrice) || 0
      const discount = Number(it.discount) || 0
      const taxRate = Number(it.taxRate) || 0
      const lineNet = qty * unitPrice - discount
      const lineTax = lineNet * (taxRate / 100)
      const lineTotal = lineNet + lineTax
      subtotal += lineNet
      taxTotal += lineTax
      return { ...it, total: lineTotal }
    })

    const orderDiscount = Number(body.discount ?? 0) || 0
    subtotal = Math.max(0, subtotal - orderDiscount)
    const total = subtotal + taxTotal

    // Replace items: delete old, create new
    await db.salesOrderItem.deleteMany({ where: { orderId: id } })

    const updated = await db.salesOrder.update({
      where: { id },
      data: {
        clientId: body.clientId,
        status: body.status ?? 'draft',
        subtotal,
        taxTotal,
        discount: orderDiscount,
        total,
        paymentMethod: body.paymentMethod,
        note: body.note ?? null,
        items: {
          create: computedItems.map((it: any) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount) || 0,
            taxRate: Number(it.taxRate) || 0,
            total: it.total,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('sales-order PUT error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Cascade: items delete via onDelete: Cascade, also delete related journal entries
    await db.journalEntry.deleteMany({ where: { refType: 'sales_order', refId: id } })
    await db.salesOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('sales-order DELETE error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
