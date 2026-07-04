import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [data, total] = await Promise.all([
      db.activity.findMany({
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true, code: true } } },
      }),
      db.activity.count(),
    ])
    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.activity.count()
    const code = body.code ?? `ACT-${String(count + 1).padStart(4, '0')}`
    const created = await db.activity.create({
      data: {
        name: body.name,
        code,
        branchId: body.branchId,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
