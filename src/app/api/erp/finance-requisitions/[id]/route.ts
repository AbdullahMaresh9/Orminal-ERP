import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postJournal, SYSTEM_ACCOUNTS } from '../route'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await db.financeRequisition.findUnique({ where: { id } })
    if (!data) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const action = body.action // 'approve' | 'reject' | 'fulfill' | 'update'
    const existing = await db.financeRequisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    let newStatus = existing.status
    let expenseTx: any = null

    if (action === 'approve') newStatus = 'approved'
    else if (action === 'reject') newStatus = 'rejected'
    else if (action === 'fulfill') {
      newStatus = 'fulfilled'
      // Create an expense finance transaction + journal + decrement safe (cash) by default
      const count = await db.financeTransaction.count({ where: { type: 'expense' } })
      const code = `EXP-${String(count + 1).padStart(4, '0')}`
      const date = new Date()
      expenseTx = await db.financeTransaction.create({
        data: {
          code,
          type: 'expense',
          amount: existing.amount,
          date,
          payee: existing.payee ?? null,
          note: `من تنفيذ طلب صرف ${existing.code}${existing.note ? ' - ' + existing.note : ''}`,
          status: 'completed',
        },
      })
      await postJournal({
        code: `JE-${code}`,
        date,
        description: `تنفيذ طلب صرف ${existing.code}`,
        refType: 'expense',
        refId: expenseTx.id,
        lines: [
          { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: existing.amount, credit: 0, description: 'مصروف من طلب صرف' },
          { accountCode: SYSTEM_ACCOUNTS.CASH, debit: 0, credit: existing.amount, description: 'صرف من الخزينة' },
        ],
      })
    } else if (action === 'update') {
      const updated = await db.financeRequisition.update({
        where: { id },
        data: {
          amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
          payee: body.payee ?? existing.payee,
          type: body.type ?? existing.type,
          note: body.note ?? existing.note,
        },
      })
      return NextResponse.json(updated)
    }

    const updated = await db.financeRequisition.update({
      where: { id },
      data: { status: newStatus },
    })
    return NextResponse.json({ ...updated, expenseTransaction: expenseTx })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.financeRequisition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
