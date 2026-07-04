import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || undefined
    const entity = url.searchParams.get('entity') || undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)

    const where: any = {}
    if (action) where.action = action
    if (entity) where.entity = entity

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ])

    // today count + by-action counts
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayCount = await db.auditLog.count({ where: { createdAt: { gte: startOfDay } } })
    const byActionRaw = await db.auditLog.groupBy({ by: ['action'], _count: true })

    return NextResponse.json({
      data,
      total,
      today: todayCount,
      byAction: byActionRaw.reduce((acc: Record<string, number>, r) => {
        acc[r.action] = r._count
        return acc
      }, {}),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
