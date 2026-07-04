import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/accounts — list all accounts with computed balance from JournalLines
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const active = searchParams.get('active')
    const q = searchParams.get('q')?.trim()

    const where: any = {}
    if (type && type !== 'all') where.type = type
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { name: { contains: q } },
        { nameAr: { contains: q } },
      ]
    }

    const accounts = await db.account.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      include: { parent: { select: { id: true, code: true, name: true } } },
    })

    // Aggregate all posted journal lines by accountId
    const agg = await db.journalLine.groupBy({
      by: ['accountId'],
      where: { entry: { status: 'posted' } },
      _sum: { debit: true, credit: true },
    })
    const map = new Map<string, { debit: number; credit: number }>()
    for (const a of agg) {
      map.set(a.accountId, { debit: a._sum.debit ?? 0, credit: a._sum.credit ?? 0 })
    }

    const data = accounts.map((a) => {
      const sums = map.get(a.id) ?? { debit: 0, credit: 0 }
      // asset/expense: balance = debit - credit; liability/equity/income: credit - debit
      const isDebitNormal = a.type === 'asset' || a.type === 'expense'
      const balance = isDebitNormal
        ? sums.debit - sums.credit
        : sums.credit - sums.debit
      return {
        ...a,
        balance,
        rawDebit: sums.debit,
        rawCredit: sums.credit,
      }
    })

    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/erp/accounts — create new account
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code, name, nameAr, type, subtype, parentId, active, isSystem } = body
    if (!code || !name || !type) {
      return NextResponse.json({ error: 'الرمز والاسم والنوع مطلوبة' }, { status: 400 })
    }
    const existing = await db.account.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'الرمز مستخدم بالفعل' }, { status: 400 })
    }
    // If parent provided, must match same type
    if (parentId) {
      const parent = await db.account.findUnique({ where: { id: parentId } })
      if (parent && parent.type !== type) {
        return NextResponse.json({ error: 'نوع الحساب الأب غير مطابق' }, { status: 400 })
      }
    }
    const created = await db.account.create({
      data: {
        code,
        name,
        nameAr: nameAr ?? null,
        type,
        subtype: subtype ?? null,
        parentId: parentId ?? null,
        active: active ?? true,
        isSystem: isSystem ?? false,
        balance: 0,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
