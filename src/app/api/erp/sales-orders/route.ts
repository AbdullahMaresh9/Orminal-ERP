import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSalesJournalEntry,
  SYSTEM_ACCOUNTS,
} from '@/lib/erp/accounting-engine'

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
        { client: { phone: { contains: q } } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const [data, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, code: true, phone: true } },
          items: { include: { product: { select: { id: true, name: true, nameAr: true, sku: true } } } },
        },
      }),
      db.salesOrder.count({ where }),
    ])

    const totalSales = data.reduce((s, o) => s + o.total, 0)
    const totalPaid = data.reduce((s, o) => s + o.paid, 0)
    const totalOutstanding = data.reduce((s, o) => s + Math.max(0, o.total - o.paid), 0)
    const avgOrderValue = data.length ? totalSales / data.length : 0

    return NextResponse.json({
      data,
      total,
      stats: {
        totalSales,
        totalPaid,
        totalOutstanding,
        avgOrderValue,
        count: total,
      },
    })
  } catch (e: any) {
    console.error('sales-orders GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Compute totals from items
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
      return {
        productId: it.productId,
        quantity: qty,
        unitPrice,
        discount,
        taxRate,
        total: lineTotal,
      }
    })

    const orderDiscount = Number(body.discount ?? 0) || 0
    subtotal = Math.max(0, subtotal - orderDiscount)
    const total = subtotal + taxTotal

    const count = await db.salesOrder.count()
    const latest = await db.salesOrder.findFirst({ orderBy: { code: 'desc' }, select: { code: true } })
    const nextNum = latest ? Math.max(count + 1, (parseInt(latest.code.replace(/^[A-Z]+-/, '')) || 0) + 1) : count + 1
    const code = `SO-${String(nextNum).padStart(4, '0')}`

    const paymentMethod = body.paymentMethod ?? 'cash'
    const isCash = paymentMethod === 'cash' || paymentMethod === 'card'

    // Find default storehouse (first one) for stock movements
    const storehouse = await db.storehouse.findFirst({ where: { active: true } })
    if (!storehouse) {
      return NextResponse.json({ error: 'لا يوجد مستودع' }, { status: 400 })
    }

    // Use a transaction: create order + items + stock movements + journal entry
    const created = await db.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          code,
          clientId: body.clientId,
          status: body.status ?? 'confirmed',
          subtotal,
          taxTotal,
          discount: orderDiscount,
          total,
          paid: isCash ? total : Number(body.paid ?? 0),
          paymentMethod,
          note: body.note ?? null,
          isPos: body.isPos ?? false,
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

      // Decrement stock & create stock movements
      for (const it of computedItems) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: it.productId, storehouseId: storehouse.id },
        })
        if (stockItem) {
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: { decrement: it.quantity } },
          })
        } else {
          // create a negative stock record (over-issued)
          await tx.stockItem.create({
            data: {
              productId: it.productId,
              storehouseId: storehouse.id,
              quantity: -it.quantity,
            },
          })
        }
        await tx.stockMovement.create({
          data: {
            productId: it.productId,
            storehouseId: storehouse.id,
            type: 'out',
            quantity: it.quantity,
            refType: 'sales_order',
            refId: order.id,
            note: `أمر بيع ${code}`,
          },
        })
      }

      // Update client balance (if credit sale, increase AR; if cash, no change to balance)
      if (!isCash) {
        await tx.client.update({
          where: { id: body.clientId },
          data: { balance: { increment: total } },
        })
      }

      // Create auto journal entry
      const journalInput = createSalesJournalEntry({
        total,
        taxTotal,
        subtotal,
        isCash,
        refId: order.id,
        description: `أمر بيع ${code}`,
      })

      // Resolve account IDs
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
          date: new Date(),
          description: journalInput.description,
          refType: 'sales_order',
          refId: order.id,
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

      // Update account balances
      for (let i = 0; i < journalInput.lines.length; i++) {
        const l = journalInput.lines[i]
        const acc = lineAccounts[i]!
        await tx.account.update({
          where: { id: acc.id },
          data: {
            // For assets: balance = debit - credit; for liabilities/equity/income: balance = credit - debit
            balance: { increment: (acc.type === 'asset' ? l.debit - l.credit : l.credit - l.debit) },
          },
        })
      }

      return order
    })

    const fullOrder = await db.salesOrder.findUnique({
      where: { id: created.id },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(fullOrder, { status: 201 })
  } catch (e: any) {
    console.error('sales-orders POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Silence unused warnings for SYSTEM_ACCOUNTS re-export guard
void SYSTEM_ACCOUNTS
