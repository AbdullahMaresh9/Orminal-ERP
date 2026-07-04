import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const status = searchParams.get('status')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { reason: { contains: q } },
        { client: { name: { contains: q } } },
      ]
    }
    if (status && status !== 'all') where.status = status

    const [data, total] = await Promise.all([
      db.salesCreditNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, code: true, phone: true } },
        },
      }),
      db.salesCreditNote.count({ where }),
    ])

    const totalCredit = data.reduce((s, c) => s + c.total, 0)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = data.filter((c) => new Date(c.createdAt) >= monthStart).reduce((s, c) => s + c.total, 0)

    return NextResponse.json({
      data,
      total,
      stats: { totalCredit, count: total, thisMonth },
    })
  } catch (e: any) {
    console.error('sales-credit-notes GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const subtotal = Number(body.subtotal ?? body.total ?? 0) || 0
    const taxTotal = Number(body.taxTotal ?? 0) || 0
    const total = subtotal + taxTotal || Number(body.total ?? 0)

    const count = await db.salesCreditNote.count()
    const code = `CN-${String(count + 1).padStart(4, '0')}`

    const created = await db.$transaction(async (tx) => {
      const cn = await tx.salesCreditNote.create({
        data: {
          code,
          clientId: body.clientId,
          invoiceId: body.invoiceId ?? null,
          status: body.status ?? 'posted',
          issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
          subtotal,
          taxTotal,
          total,
          reason: body.reason ?? null,
          note: body.note ?? null,
        },
      })

      // Reduce client balance (credit note reduces AR)
      await tx.client.update({
        where: { id: body.clientId },
        data: { balance: { decrement: total } },
      })

      // Reverse the original invoice's journal: Dr Sales Revenue + Output VAT, Cr AR
      // Build reversed lines
      const arAcc = await tx.account.findUnique({ where: { code: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE } })
      const salesAcc = await tx.account.findUnique({ where: { code: SYSTEM_ACCOUNTS.SALES_REVENUE } })
      const vatAcc = await tx.account.findUnique({ where: { code: SYSTEM_ACCOUNTS.OUTPUT_VAT } })

      const jeCount = await tx.journalEntry.count()
      const jeCode = `JE-${String(jeCount + 1).padStart(5, '0')}`

      const lines = [
        { accountId: salesAcc!.id, debit: subtotal, credit: 0, description: 'عكس إيراد مبيعات' },
        { accountId: vatAcc!.id, debit: taxTotal, credit: 0, description: 'عكس ضريبة قيمة مضافة' },
        { accountId: arAcc!.id, debit: 0, credit: total, description: 'عكس ذمم مدينة' },
      ]

      await tx.journalEntry.create({
        data: {
          code: jeCode,
          date: new Date(),
          description: `إشعار دائن ${code}`,
          refType: 'sales_credit_note',
          refId: cn.id,
          status: 'posted',
          totalDebit: subtotal + taxTotal,
          totalCredit: total,
          lines: { create: lines },
        },
      })

      // Update account balances
      for (const l of lines) {
        const acc = await tx.account.findUnique({ where: { id: l.accountId } })
        if (!acc) continue
        await tx.account.update({
          where: { id: acc.id },
          data: {
            balance: { increment: (acc.type === 'asset' ? l.debit - l.credit : l.credit - l.debit) },
          },
        })
      }

      return cn
    })

    const fullCn = await db.salesCreditNote.findUnique({
      where: { id: created.id },
      include: { client: true },
    })

    return NextResponse.json(fullCn, { status: 201 })
  } catch (e: any) {
    console.error('sales-credit-note POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
