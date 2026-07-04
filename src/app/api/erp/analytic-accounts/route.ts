import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/analytic-accounts
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const active = searchParams.get('active')

    const where: any = {}
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { name: { contains: q } },
      ]
    }
    const data = await db.analyticAccount.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: { parent: { select: { id: true, code: true, name: true } } },
    })
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/erp/analytic-accounts
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code, name, parentId, active } = body
    if (!code || !name) {
      return NextResponse.json({ error: 'الرمز والاسم مطلوبة' }, { status: 400 })
    }
    const existing = await db.analyticAccount.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'الرمز مستخدم بالفعل' }, { status: 400 })
    }
    const created = await db.analyticAccount.create({
      data: {
        code,
        name,
        parentId: parentId ?? null,
        active: active ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
