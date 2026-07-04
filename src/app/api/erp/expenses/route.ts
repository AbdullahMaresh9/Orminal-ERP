import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

// Helper: post a balanced journal entry tied to a finance transaction
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const where: any = { type: 'expense' }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(`${to}T23:59:59`)
    }
    const [txs, banks, safes] = await Promise.all([
      db.financeTransaction.findMany({ where, orderBy: { date: 'desc' } }),
      db.bankAccount.findMany({ select: { id: true, name: true, bankName: true } }),
      db.safe.findMany({ select: { id: true, name: true, code: true } }),
    ])
    const bankMap = new Map(banks.map((b) => [b.id, b]))
    const safeMap = new Map(safes.map((s) => [s.id, s]))
    const data = txs.map((tx) => ({
      ...tx,
      bankAccount: tx.bankAccountId ? bankMap.get(tx.bankAccountId) ?? null : null,
      safe: tx.safeId ? safeMap.get(tx.safeId) ?? null : null,
    }))
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

    const count = await db.financeTransaction.count({ where: { type: 'expense' } })
    const code = `EXP-${String(count + 1).padStart(4, '0')}`
    const date = body.date ? new Date(body.date) : new Date()

    const useBank = !!body.bankAccountId
    const useSafe = !useBank && !!body.safeId

    // 1) Create the finance transaction
    const tx = await db.financeTransaction.create({
      data: {
        code,
        type: 'expense',
        amount,
        date,
        bankAccountId: useBank ? body.bankAccountId : null,
        safeId: useSafe ? body.safeId : null,
        payee: body.payee ?? null,
        reference: body.reference ?? null,
        note: body.note ?? null,
        status: 'completed',
      },
    })
    const bankAccount = useBank ? await db.bankAccount.findUnique({ where: { id: body.bankAccountId }, select: { id: true, name: true, bankName: true } }) : null
    const safe = useSafe ? await db.safe.findUnique({ where: { id: body.safeId }, select: { id: true, name: true, code: true } }) : null

    // 2) Auto journal: Dr Operating Expenses (6000), Cr Cash (1000) or Bank (1100)
    const creditAccount = useBank ? SYSTEM_ACCOUNTS.BANK : SYSTEM_ACCOUNTS.CASH
    await postJournal({
      code: `JE-${code}`,
      date,
      description: `مصروف ${code} - ${body.payee ?? ''}`.trim(),
      refType: 'expense',
      refId: tx.id,
      lines: [
        { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: amount, credit: 0, description: body.category ?? 'مصروف تشغيلي' },
        { accountCode: creditAccount, debit: 0, credit: amount, description: useBank ? 'صرف من بنك' : 'صرف من خزينة' },
      ],
    })

    // 3) Decrement bank or safe balance
    if (useBank) {
      await db.bankAccount.update({ where: { id: body.bankAccountId }, data: { balance: { decrement: amount } } })
    } else if (useSafe) {
      await db.safe.update({ where: { id: body.safeId }, data: { balance: { decrement: amount } } })
    }

    return NextResponse.json({ ...tx, bankAccount, safe }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
