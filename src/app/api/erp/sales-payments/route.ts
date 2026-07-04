import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createReceiptJournalEntry } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const method = searchParams.get('method')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { reference: { contains: q } },
        { description: { contains: q } },
        { client: { name: { contains: q } } },
      ]
    }
    if (method && method !== 'all') where.method = method

    const [data, total] = await Promise.all([
      db.salesPayment.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          client: { select: { id: true, name: true, code: true, phone: true } },
        },
      }),
      db.salesPayment.count({ where }),
    ])

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthPayments = data.filter((p) => new Date(p.date) >= monthStart)
    const totalReceipts = thisMonthPayments.reduce((s, p) => s + p.amount, 0)
    const avgAmount = thisMonthPayments.length ? totalReceipts / thisMonthPayments.length : 0

    // By method breakdown
    const byMethod: Record<string, number> = {}
    for (const p of data) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount
    }

    return NextResponse.json({
      data,
      total,
      stats: {
        totalReceipts,
        count: thisMonthPayments.length,
        avgAmount,
        byMethod,
      },
    })
  } catch (e: any) {
    console.error('sales-payments GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body.amount ?? 0)
    if (amount <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const count = await db.salesPayment.count()
    const code = `RC-${String(count + 1).padStart(4, '0')}`

    const created = await db.$transaction(async (tx) => {
      const payment = await tx.salesPayment.create({
        data: {
          code,
          type: 'receipt',
          clientId: body.clientId,
          invoiceId: body.invoiceId ?? null,
          amount,
          date: body.date ? new Date(body.date) : new Date(),
          method: body.method ?? 'cash',
          reference: body.reference ?? null,
          status: 'completed',
          description: body.description ?? null,
        },
      })

      // Reduce client balance
      await tx.client.update({
        where: { id: body.clientId },
        data: { balance: { decrement: amount } },
      })

      // If linked invoice, increase paid amount
      if (body.invoiceId) {
        await tx.salesInvoice.update({
          where: { id: body.invoiceId },
          data: { paid: { increment: amount } },
        })
      }

      // Create auto journal via createReceiptJournalEntry: Dr Cash, Cr AR
      const journalInput = createReceiptJournalEntry({
        amount,
        refId: payment.id,
        description: `سند قبض ${code}`,
      })

      const lineAccounts = await Promise.all(
        journalInput.lines.map((l) =>
          tx.account.findUnique({ where: { code: l.accountCode } })
        )
      )

      const jeCount = await tx.journalEntry.count()
      const jeCode = `JE-${String(jeCount + 1).padStart(5, '0')}`

      await tx.journalEntry.create({
        data: {
          code: jeCode,
          date: payment.date,
          description: journalInput.description,
          refType: 'sales_payment',
          refId: payment.id,
          status: 'posted',
          totalDebit: amount,
          totalCredit: amount,
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

      return payment
    })

    const fullPayment = await db.salesPayment.findUnique({
      where: { id: created.id },
      include: { client: true },
    })

    return NextResponse.json(fullPayment, { status: 201 })
  } catch (e: any) {
    console.error('sales-payment POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
