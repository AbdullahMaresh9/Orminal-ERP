import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await db.bankAccount.findUnique({ where: { id } })
    if (!data) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    // Include recent finance transactions involving this bank account (statement)
    const transactions = await db.financeTransaction.findMany({
      where: { bankAccountId: id },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json({ ...data, transactions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    // openingBalance adjusts balance if provided
    const update: any = {
      name: body.name,
      bankName: body.bankName,
      iban: body.iban ?? null,
      accountNo: body.accountNo ?? null,
      currency: body.currency,
      active: body.active,
    }
    if (body.openingBalance !== undefined) {
      update.balance = Number(body.openingBalance)
    }
    const updated = await db.bankAccount.update({ where: { id }, data: update })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.bankAccount.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
