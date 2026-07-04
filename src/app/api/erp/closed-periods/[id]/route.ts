import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.closedPeriod.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — update name/dates and/or status transitions (close/lock/reopen)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.closedPeriod.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.endDate) data.endDate = new Date(body.endDate)
    if (body.status) {
      data.status = body.status
      if (body.status === 'closed' || body.status === 'locked') {
        data.closedBy = body.closedBy ?? 'admin'
        data.closedAt = new Date()
      } else if (body.status === 'open') {
        data.closedBy = null
        data.closedAt = null
      }
    }
    const updated = await db.closedPeriod.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.closedPeriod.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
