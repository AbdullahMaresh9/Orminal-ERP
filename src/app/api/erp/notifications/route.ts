import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: notifications, total: notifications.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Find first admin user as default recipient
    const user = await db.user.findFirst({ where: { role: 'admin' } })
    if (!user) return NextResponse.json({ error: 'no user' }, { status: 400 })
    const created = await db.notification.create({
      data: {
        userId: user.id,
        title: body.title ?? 'إشعار',
        message: body.message ?? '',
        type: body.type ?? 'info',
        category: body.category ?? 'system',
        link: body.link,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
