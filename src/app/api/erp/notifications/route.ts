import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, serverError } from '@/lib/erp/api-response'

const ALLOWED_TYPES = ['info', 'success', 'warning', 'error']
const ALLOWED_CATEGORIES = ['system', 'finance', 'sales', 'purchase', 'inventory', 'hr', 'workflow']

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || undefined
    const category = url.searchParams.get('category') || undefined
    const isRead = url.searchParams.get('isRead')
    const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim()

    const where: any = {}
    if (type && ALLOWED_TYPES.includes(type)) where.type = type
    if (category && ALLOWED_CATEGORIES.includes(category)) where.category = category
    if (isRead === 'true' || isRead === 'false') where.isRead = isRead === 'true'
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { message: { contains: q } },
      ]
    }

    const [data, total, unreadCount, byTypeRaw, byCategoryRaw] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          user: { select: { id: true, nameAr: true, nameEn: true, username: true } },
        },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { isRead: false } }),
      db.notification.groupBy({ by: ['type'], _count: true }),
      db.notification.groupBy({ by: ['category'], _count: true }),
    ])

    const byType = byTypeRaw.reduce((acc: Record<string, number>, r) => {
      acc[r.type] = r._count
      return acc
    }, {})
    const byCategory = byCategoryRaw.reduce((acc: Record<string, number>, r) => {
      acc[r.category] = r._count
      return acc
    }, {})

    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
        total,
        unread: unreadCount,
        byType,
        byCategory,
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.userId) {
      // Default: assign to first active user (for demo)
      const user = await db.user.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } })
      if (!user) return badRequest('لا يوجد مستخدم لإرسال الإشعار إليه', 'NO_USER')
      body.userId = user.id
    }
    const created = await db.notification.create({
      data: {
        userId: body.userId,
        title: body.title ?? 'إشعار',
        message: body.message ?? '',
        type: ALLOWED_TYPES.includes(body.type) ? body.type : 'info',
        category: ALLOWED_CATEGORIES.includes(body.category) ? body.category : 'system',
        link: body.link ?? null,
        isRead: body.isRead ?? false,
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// Bulk: mark all as read for a given user (or all if no userId)
export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    const where: any = { isRead: false }
    if (userId) where.userId = userId
    const result = await db.notification.updateMany({ where, data: { isRead: true } })
    return ok({ updated: result.count })
  } catch (e: any) {
    return serverError(e.message)
  }
}
