import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tx = await db.financeTransaction.findUnique({ where: { id } })
    if (!tx) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    const [bankAccount, safe] = await Promise.all([
      tx.bankAccountId ? db.bankAccount.findUnique({ where: { id: tx.bankAccountId }, select: { id: true, name: true, bankName: true, iban: true, accountNo: true } }) : Promise.resolve(null),
      tx.safeId ? db.safe.findUnique({ where: { id: tx.safeId }, select: { id: true, name: true, code: true } }) : Promise.resolve(null),
    ])
    return NextResponse.json({ ...tx, bankAccount, safe })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.financeTransaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
