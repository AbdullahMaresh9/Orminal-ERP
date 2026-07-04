import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/closed-periods
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const where: any = {}
    if (status && status !== 'all') where.status = status
    const data = await db.closedPeriod.findMany({
      where,
      orderBy: [{ startDate: 'desc' }],
    })
    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — create new period
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, startDate, endDate, status } = body
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'الاسم وتاريخ البداية والنهاية مطلوبة' }, { status: 400 })
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json({ error: 'تاريخ النهاية يجب أن يكون بعد البداية' }, { status: 400 })
    }
    const created = await db.closedPeriod.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status ?? 'open',
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
