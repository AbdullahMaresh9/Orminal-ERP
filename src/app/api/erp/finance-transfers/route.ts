import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

async function postJournal(args: {
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

// Resolve "bank:<id>" or "safe:<id>" into { kind, id }
function parseRef(ref: string): { kind: 'bank' | 'safe'; id: string } | null {
  if (!ref) return null
  const [kind, id] = ref.split(':')
  if ((kind === 'bank' || kind === 'safe') && id) return { kind, id }
  return null
}

function accountCodeFor(kind: 'bank' | 'safe') {
  return kind === 'bank' ? SYSTEM_ACCOUNTS.BANK : SYSTEM_ACCOUNTS.CASH
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const where: any = { type: 'transfer' }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(`${to}T23:59:59`)
    }
    const data = await db.financeTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
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

    const fromRef = parseRef(body.fromAccountId)
    const toRef = parseRef(body.toAccountId)
    if (!fromRef || !toRef) return NextResponse.json({ error: 'اختر الحساب المصدر والوجهة' }, { status: 400 })
    if (fromRef.kind === toRef.kind && fromRef.id === toRef.id) {
      return NextResponse.json({ error: 'لا يمكن التحويل بين نفس الحساب' }, { status: 400 })
    }

    const count = await db.financeTransaction.count({ where: { type: 'transfer' } })
    const code = `TRF-${String(count + 1).padStart(4, '0')}`
    const date = body.date ? new Date(body.date) : new Date()

    // Pre-fetch labels for the response
    const [fromLabel, toLabel] = await Promise.all([
      fromRef.kind === 'bank'
        ? db.bankAccount.findUnique({ where: { id: fromRef.id }, select: { name: true, bankName: true } })
        : db.safe.findUnique({ where: { id: fromRef.id }, select: { name: true, code: true } }),
      toRef.kind === 'bank'
        ? db.bankAccount.findUnique({ where: { id: toRef.id }, select: { name: true, bankName: true } })
        : db.safe.findUnique({ where: { id: toRef.id }, select: { name: true, code: true } }),
    ])

    const tx = await db.financeTransaction.create({
      data: {
        code,
        type: 'transfer',
        amount,
        date,
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        note: body.note ?? null,
        status: 'completed',
      },
    })

    // Journal: Dr toAccount, Cr fromAccount
    await postJournal({
      code: `JE-${code}`,
      date,
      description: `تحويل ${code}`,
      refType: 'transfer',
      refId: tx.id,
      lines: [
        { accountCode: accountCodeFor(toRef.kind), debit: amount, credit: 0, description: `إيداع إلى ${toLabel?.name ?? ''}`.trim() },
        { accountCode: accountCodeFor(fromRef.kind), debit: 0, credit: amount, description: `صرف من ${fromLabel?.name ?? ''}`.trim() },
      ],
    })

    // Update balances: decrement source, increment destination
    if (fromRef.kind === 'bank') {
      await db.bankAccount.update({ where: { id: fromRef.id }, data: { balance: { decrement: amount } } })
    } else {
      await db.safe.update({ where: { id: fromRef.id }, data: { balance: { decrement: amount } } })
    }
    if (toRef.kind === 'bank') {
      await db.bankAccount.update({ where: { id: toRef.id }, data: { balance: { increment: amount } } })
    } else {
      await db.safe.update({ where: { id: toRef.id }, data: { balance: { increment: amount } } })
    }

    return NextResponse.json(
      {
        ...tx,
        fromAccount: fromLabel,
        toAccount: toLabel,
      },
      { status: 201 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
