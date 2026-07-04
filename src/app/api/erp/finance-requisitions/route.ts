import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const where: any = {}
    if (status && status !== 'all') where.status = status
    const data = await db.financeRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body.amount || 0)
    if (amount <= 0) return NextResponse.json({ error: 'المبلغ غير صحيح' }, { status: 400 })

    const count = await db.financeRequisition.count()
    const code = `FRQ-${String(count + 1).padStart(4, '0')}`

    const created = await db.financeRequisition.create({
      data: {
        code,
        amount,
        payee: body.payee ?? null,
        type: body.type ?? 'expense',
        note: body.note ?? null,
        status: 'draft',
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Helper used by [id]/route.ts fulfill action
export async function postJournal(args: {
  code: string
  date: Date
  description: string
  refType: string
  refId: string
  lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
  const accounts = await db.account.findMany({
    where: { code: { in: args.lines.map((l) => l.accountCode) } },
    select: { id: true, code: true },
  })
  const codeToId = new Map(accounts.map((a) => [a.code, a.id]))
  const totalDebit = args.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = args.lines.reduce((s, l) => s + l.credit, 0)
  return db.journalEntry.create({
    data: {
      code: args.code,
      date: args.date,
      description: args.description,
      refType: args.refType,
      refId: args.refId,
      status: 'posted',
      totalDebit,
      totalCredit,
      lines: {
        create: args.lines.map((l) => ({
          accountId: codeToId.get(l.accountCode)!,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      },
    },
  })
}

export { SYSTEM_ACCOUNTS }
