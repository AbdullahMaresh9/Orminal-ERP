import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await db.safe.findUnique({ where: { id } })
    if (!data) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    const branch = data.branchId
      ? await db.branch.findUnique({ where: { id: data.branchId }, select: { id: true, name: true, code: true } })
      : null
    const transactions = await db.financeTransaction.findMany({
      where: { safeId: id },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json({ ...data, branch, transactions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const update: any = {
      name: body.name,
      code: body.code,
      branchId: body.branchId || null,
      currency: body.currency,
      active: body.active,
    }
    if (body.openingBalance !== undefined) {
      update.balance = Number(body.openingBalance)
    }
    const updated = await db.safe.update({
      where: { id },
      data: update,
    })
    const branch = updated.branchId
      ? await db.branch.findUnique({ where: { id: updated.branchId }, select: { id: true, name: true, code: true } })
      : null
    return NextResponse.json({ ...updated, branch })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.safe.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
