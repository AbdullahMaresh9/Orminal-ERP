import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [data, total] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true, phone: true,
          avatar: true, branchId: true, active: true, createdAt: true, updatedAt: true,
          branch: { select: { name: true, code: true } },
          _count: { select: { auditLogs: true, notifications: true } },
        },
      }),
      db.user.count(),
    ])
    // Strip passwords from response (still SELECT no password)
    return NextResponse.json({ data, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const count = await db.user.count()
    // USR-XXXX is just an internal hint — users have no code field; skip
    void count
    const created = await db.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: body.password ?? 'changeme123',
        role: body.role ?? 'employee',
        phone: body.phone ?? null,
        branchId: body.branchId ?? null,
        active: body.active ?? true,
      },
      select: { id: true, name: true, email: true, role: true, phone: true, branchId: true, active: true, createdAt: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
