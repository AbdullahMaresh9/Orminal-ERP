import { db } from '@/lib/db'
import { ok, list, badRequest } from '@/lib/erp/api-response'

export async function GET() {
  const notifications = await db.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return list(notifications, notifications.length)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const user = await db.user.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } })
    if (!user) return badRequest('no user')
    const created = await db.notification.create({
      data: { userId: user.id, title: body.title ?? 'إشعار', message: body.message ?? '', type: body.type ?? 'info', category: body.category ?? 'system', link: body.link },
    })
    return ok(created)
  } catch (e: any) {
    return badRequest(e.message)
  }
}
