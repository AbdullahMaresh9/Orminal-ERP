import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSalesJournalEntry } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const status = searchParams.get('status')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { note: { contains: q } },
        { client: { name: { contains: q } } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const [data, total] = await Promise.all([
      db.salesInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, code: true, phone: true } },
          items: { include: { product: { select: { id: true, name: true, nameAr: true, sku: true } } } },
        },
      }),
      db.salesInvoice.count({ where }),
    ])

    const totalInvoiced = data.reduce((s, o) => s + o.total, 0)
    const totalCollected = data.reduce((s, o) => s + o.paid, 0)
    const outstanding = data.reduce((s, o) => s + Math.max(0, o.total - o.paid), 0)

    return NextResponse.json({
      data,
      total,
      stats: { totalInvoiced, totalCollected, outstanding, count: total },
    })
  } catch (e: any) {
    console.error('sales-invoices GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items = (body.items ?? []).filter((it: any) => it.productId && Number(it.quantity) > 0)
    if (!items.length) {
      return NextResponse.json({ error: 'لا توجد عناصر صالحة' }, { status: 400 })
    }

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
      return { productId: it.productId, quantity: qty, unitPrice, discount, taxRate, total: lineTotal }
    })

    const invoiceDiscount = Number(body.discount ?? 0) || 0
    subtotal = Math.max(0, subtotal - invoiceDiscount)
    const total = subtotal + taxTotal

    const count = await db.salesInvoice.count()
    const code = `INV-${String(count + 1).padStart(4, '0')}`

    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date()
    const dueDate = body.dueDate ? new Date(body.dueDate) : null

    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.create({
        data: {
          code,
          clientId: body.clientId,
          orderId: body.orderId ?? null,
          status: body.status ?? 'posted',
          issueDate,
          dueDate,
          subtotal,
          taxTotal,
          discount: invoiceDiscount,
          total,
          paid: 0,
          note: body.note ?? null,
          items: {
            create: computedItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              taxRate: it.taxRate,
              total: it.total,
            })),
          },
        },
        include: { items: true },
      })

      // Update client balance (increase AR for invoice)
      await tx.client.update({
        where: { id: body.clientId },
        data: { balance: { increment: total } },
      })

      // Create auto journal entry: Dr AR, Cr Sales Revenue, Cr Output VAT
      const journalInput = createSalesJournalEntry({
        total,
        taxTotal,
        subtotal,
        isCash: false, // invoices are credit sales by default
        refId: invoice.id,
        description: `فاتورة ضريبية ${code}`,
      })

      const lineAccounts = await Promise.all(
        journalInput.lines.map((l) =>
          tx.account.findUnique({ where: { code: l.accountCode } })
        )
      )

      const jeCount = await tx.journalEntry.count()
      const jeCode = `JE-${String(jeCount + 1).padStart(5, '0')}`
      const totalDebit = journalInput.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = journalInput.lines.reduce((s, l) => s + l.credit, 0)

      await tx.journalEntry.create({
        data: {
          code: jeCode,
          date: issueDate,
          description: journalInput.description,
          refType: 'sales_invoice',
          refId: invoice.id,
          status: 'posted',
          totalDebit,
          totalCredit,
          lines: {
            create: journalInput.lines.map((l, i) => ({
              accountId: lineAccounts[i]!.id,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        },
      })

      for (let i = 0; i < journalInput.lines.length; i++) {
        const l = journalInput.lines[i]
        const acc = lineAccounts[i]!
        await tx.account.update({
          where: { id: acc.id },
          data: {
            balance: { increment: (acc.type === 'asset' ? l.debit - l.credit : l.credit - l.debit) },
          },
        })
      }

      return invoice
    })

    const fullInvoice = await db.salesInvoice.findUnique({
      where: { id: created.id },
      include: { client: true, items: { include: { product: true } } },
    })

    return NextResponse.json(fullInvoice, { status: 201 })
  } catch (e: any) {
    console.error('sales-invoice POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
