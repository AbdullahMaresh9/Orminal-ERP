import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [data, total] = await Promise.all([
      db.partner.findMany({
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true, code: true } } },
      }),
      db.partner.count(),
    ])
    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.partner.count()
    const code = `PART-${String(count + 1).padStart(4, '0')}`
    const created = await db.partner.create({
      data: {
        name: body.name,
        share: Number(body.share ?? 0),
        branchId: body.branchId,
      },
    })
    void code
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
