import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [data, branches] = await Promise.all([
      db.safe.findMany({ orderBy: { createdAt: 'desc' } }),
      db.branch.findMany({ select: { id: true, name: true, code: true } }),
    ])
    const branchMap = new Map(branches.map((b) => [b.id, b]))
    const enriched = data.map((s) => ({
      ...s,
      branch: s.branchId ? branchMap.get(s.branchId) ?? null : null,
    }))
    return NextResponse.json({ data: enriched, total: enriched.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.safe.count()
    const code = body.code ?? `SAFE-${String(count + 1).padStart(4, '0')}`
    const created = await db.safe.create({
      data: {
        name: body.name,
        code,
        branchId: body.branchId || null,
        currency: body.currency ?? 'SAR',
        balance: Number(body.openingBalance ?? 0),
        active: body.active ?? true,
      },
    })
    const branch = created.branchId
      ? await db.branch.findUnique({ where: { id: created.branchId }, select: { id: true, name: true, code: true } })
      : null
    return NextResponse.json({ ...created, branch }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
