import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await db.salesInvoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    })
    if (!invoice) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(invoice)
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

    const invoiceDiscount = Number(body.discount ?? 0) || 0
    subtotal = Math.max(0, subtotal - invoiceDiscount)
    const total = subtotal + taxTotal

    await db.salesInvoiceItem.deleteMany({ where: { invoiceId: id } })

    const updated = await db.salesInvoice.update({
      where: { id },
      data: {
        clientId: body.clientId,
        status: body.status ?? 'posted',
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtotal,
        taxTotal,
        discount: invoiceDiscount,
        total,
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
    console.error('sales-invoice PUT error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.journalEntry.deleteMany({ where: { refType: 'sales_invoice', refId: id } })
    await db.salesInvoice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('sales-invoice DELETE error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
