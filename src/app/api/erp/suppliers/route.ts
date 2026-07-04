import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const active = searchParams.get('active')

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { contactName: { contains: q } },
        { phone: { contains: q } },
      ]
    }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    const [data, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { purchaseOrders: true, purchaseInvoices: true, purchasePayments: true } },
        },
      }),
      db.supplier.count({ where }),
    ])

    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Auto-generate code if missing: SUP-0001
    let code = (body.code || '').trim()
    if (!code) {
      const count = await db.supplier.count()
      code = `SUP-${String(count + 1).padStart(4, '0')}`
    }

    // Check uniqueness
    const existing = await db.supplier.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'الرمز مستخدم مسبقاً' }, { status: 400 })
    }

    const openingBalance = Number(body.openingBalance) || 0
    const created = await db.supplier.create({
      data: {
        code,
        name: body.name?.trim() || '',
        contactName: body.contactName?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        taxNumber: body.taxNumber?.trim() || null,
        openingBalance,
        balance: openingBalance,
        active: body.active !== false,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
