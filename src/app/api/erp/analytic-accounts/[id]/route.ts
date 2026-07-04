import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/erp/analytic-accounts/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.analyticAccount.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    })
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.analyticAccount.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

    const data: any = {
      name: body.name ?? existing.name,
      parentId: body.parentId ?? existing.parentId,
      active: body.active ?? existing.active,
    }
    if (body.code && body.code !== existing.code) {
      const dup = await db.analyticAccount.findUnique({ where: { code: body.code } })
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'الرمز مستخدم بالفعل' }, { status: 400 })
      }
      data.code = body.code
    }
    const updated = await db.analyticAccount.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const children = await db.analyticAccount.count({ where: { parentId: id } })
    if (children > 0) {
      return NextResponse.json({ error: 'لا يمكن حذف مركز له فروع' }, { status: 400 })
    }
    await db.analyticAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
