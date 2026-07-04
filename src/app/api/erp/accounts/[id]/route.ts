import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/accounts/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await db.account.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    })
    if (!account) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const sums = await db.journalLine.aggregate({
      where: { accountId: id, entry: { status: 'posted' } },
      _sum: { debit: true, credit: true },
    })
    const debit = sums._sum.debit ?? 0
    const credit = sums._sum.credit ?? 0
    const isDebitNormal = account.type === 'asset' || account.type === 'expense'
    const balance = isDebitNormal ? debit - credit : credit - debit

    return NextResponse.json({ ...account, balance, rawDebit: debit, rawCredit: credit })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/erp/accounts/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    // Protect code+type for system accounts
    const data: any = {
      name: body.name ?? existing.name,
      nameAr: body.nameAr ?? existing.nameAr,
      subtype: body.subtype ?? existing.subtype,
      parentId: body.parentId ?? existing.parentId,
      active: body.active ?? existing.active,
    }
    if (!existing.isSystem) {
      // Non-system: allow code and type updates if not duplicate
      if (body.code && body.code !== existing.code) {
        const dup = await db.account.findUnique({ where: { code: body.code } })
        if (dup && dup.id !== id) {
          return NextResponse.json({ error: 'الرمز مستخدم بالفعل' }, { status: 400 })
        }
        data.code = body.code
      }
      if (body.type) data.type = body.type
    }
    // If parent provided, validate same type
    const newType = data.type ?? existing.type
    if (data.parentId) {
      const parent = await db.account.findUnique({ where: { id: data.parentId } })
      if (parent && parent.type !== newType) {
        return NextResponse.json({ error: 'نوع الحساب الأب غير مطابق' }, { status: 400 })
      }
    }
    const updated = await db.account.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/erp/accounts/[id] — block if isSystem
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    if (existing.isSystem) {
      return NextResponse.json({ error: 'لا يمكن حذف حساب نظامي' }, { status: 400 })
    }
    // Check for children
    const children = await db.account.count({ where: { parentId: id } })
    if (children > 0) {
      return NextResponse.json({ error: 'لا يمكن حذف حساب له فروع' }, { status: 400 })
    }
    // Check for journal lines
    const lineCount = await db.journalLine.count({ where: { accountId: id } })
    if (lineCount > 0) {
      return NextResponse.json({ error: 'لا يمكن حذف حساب مرتبط بقيود' }, { status: 400 })
    }
    await db.account.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
