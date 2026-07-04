import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const data = await db.bankAccount.findMany({
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
    const created = await db.bankAccount.create({
      data: {
        name: body.name,
        bankName: body.bankName ?? '',
        iban: body.iban ?? null,
        accountNo: body.accountNo ?? null,
        currency: body.currency ?? 'SAR',
        balance: Number(body.openingBalance ?? 0),
        active: body.active ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
