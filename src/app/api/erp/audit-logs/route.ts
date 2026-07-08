import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError, parsePagination } from '@/lib/erp/api-response'

const ALLOWED_ACTIONS = ['create', 'update', 'delete', 'post', 'reverse', 'cancel', 'approve', 'login', 'logout', 'export']

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || undefined
    const moduleCode = url.searchParams.get('module') || url.searchParams.get('moduleCode') || undefined
    const userId = url.searchParams.get('userId') || undefined
    const from = url.searchParams.get('from') // ISO date
    const to = url.searchParams.get('to') // ISO date
    const { page, pageSize, skip } = parsePagination(req)

    const where: any = {}
    if (action && ALLOWED_ACTIONS.includes(action)) where.action = action
    if (moduleCode) where.moduleCode = moduleCode
    if (userId) where.userId = userId
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const t = new Date(to)
        t.setHours(23, 59, 59, 999)
        where.createdAt.lte = t
      }
    }

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, nameAr: true, nameEn: true, username: true, email: true } },
        },
      }),
      db.auditLog.count({ where }),
    ])

    // KPI counts (independent of pagination)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const [todayCount, createAction, updateAction, deleteAction, postAction, byModuleRaw] = await Promise.all([
      db.auditLog.count({ where: { createdAt: { gte: startOfDay } } }),
      db.auditLog.count({ where: { action: 'create' } }),
      db.auditLog.count({ where: { action: 'update' } }),
      db.auditLog.count({ where: { action: 'delete' } }),
      db.auditLog.count({ where: { action: 'post' } }),
      db.auditLog.groupBy({ by: ['moduleCode'], _count: true }),
    ])

    const byModule = byModuleRaw.reduce((acc: Record<string, number>, r) => {
      acc[r.moduleCode] = r._count
      return acc
    }, {})

    const totalPages = Math.ceil(total / pageSize) || 1
    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages },
        extras: {
          today: todayCount,
          byAction: { create: createAction, update: updateAction, delete: deleteAction, post: postAction },
          byModule,
        },
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
