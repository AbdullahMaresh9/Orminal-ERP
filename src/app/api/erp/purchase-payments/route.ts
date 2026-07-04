import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPaymentJournalEntry } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const supplierId = searchParams.get('supplierId')

    const where: any = {}
    if (status) where.status = status
    if (method) where.method = method
    if (supplierId) where.supplierId = supplierId
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { reference: { contains: q } },
        { description: { contains: q } },
        { supplier: { name: { contains: q } } },
        { supplier: { code: { contains: q } } },
      ]
    }

    const [data, total] = await Promise.all([
      db.purchasePayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, code: true, phone: true } },
        },
      }),
      db.purchasePayment.count({ where }),
    ])

    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.supplierId) return NextResponse.json({ error: 'المورد مطلوب' }, { status: 400 })
    const amount = Number(body.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })

    const supplier = await db.supplier.findUnique({ where: { id: body.supplierId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const count = await db.purchasePayment.count()
    const code = `PP-${String(count + 1).padStart(4, '0')}`
    const date = body.date ? new Date(body.date) : new Date()
    const method = body.method || 'cash'
    const status = body.status || 'completed'

    const created = await db.purchasePayment.create({
      data: {
        code,
        type: 'payment',
        supplierId: body.supplierId,
        invoiceId: body.invoiceId || null,
        amount,
        date,
        method,
        reference: body.reference || null,
        status,
        description: body.description || null,
      },
      include: { supplier: true },
    })

    // Update supplier balance (reduce payables)
    await db.supplier.update({
      where: { id: body.supplierId },
      data: { balance: { decrement: amount } },
    })

    // If linked invoice, update its paid amount
    if (body.invoiceId) {
      const inv = await db.purchaseInvoice.findUnique({ where: { id: body.invoiceId } })
      if (inv) {
        const newPaid = Math.min(inv.total, inv.paid + amount)
        const newStatus = newPaid >= inv.total ? 'paid' : 'posted'
        await db.purchaseInvoice.update({
          where: { id: inv.id },
          data: { paid: newPaid, status: newStatus },
        })
      }
    }

    // Auto journal entry: Dr AP, Cr Cash
    try {
      const entryInput = createPaymentJournalEntry({
        amount,
        refId: created.id,
        description: `سند صرف ${code} - ${supplier.name}`,
      })

      const codes = [...new Set(entryInput.lines.map((l) => l.accountCode))]
      const accounts = await db.account.findMany({ where: { code: { in: codes } } })
      const codeToId = new Map(accounts.map((a) => [a.code, a.id]))

      const validLines = entryInput.lines
        .map((l) => ({ ...l, accountId: codeToId.get(l.accountCode) }))
        .filter((l) => l.accountId)

      if (validLines.length === entryInput.lines.length) {
        const totalDebit = validLines.reduce((s, l) => s + l.debit, 0)
        const totalCredit = validLines.reduce((s, l) => s + l.credit, 0)
        await db.journalEntry.create({
          data: {
            code: `JE-PP-${code}`,
            date,
            description: entryInput.description,
            refType: 'purchase_payment',
            refId: created.id,
            status: 'posted',
            totalDebit,
            totalCredit,
            lines: {
              create: validLines.map((l) => ({
                accountId: l.accountId!,
                debit: l.debit,
                credit: l.credit,
                description: l.description,
              })),
            },
          },
        })
        for (const l of validLines) {
          await db.account.update({
            where: { id: l.accountId! },
            data: { balance: { increment: l.debit - l.credit } },
          })
        }
      }
    } catch (journalErr) {
      console.error('Journal creation failed:', journalErr)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
