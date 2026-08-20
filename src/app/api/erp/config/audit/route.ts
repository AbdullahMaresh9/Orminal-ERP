// System Configuration — audit log reader (CONFIG_AUDIT canRead).
import { db } from '@/lib/db'
import { list, serverError } from '@/lib/erp/api-response'
import { requireConfigCapability } from '@/lib/config/permissions'
import { isAuthFailure } from '@/lib/erp/rbac'

export async function GET(req: Request) {
  try {
    const auth = await requireConfigCapability('CONFIG_AUDIT', 'canRead')
    if (isAuthFailure(auth)) return auth

    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const settingKey = url.searchParams.get('key')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)

    const where: Record<string, string> = {}
    if (category) where.category = category
    if (settingKey) where.settingKey = settingKey

    const logs = await db.settingAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Resolve usernames without trusting the client for identity
    const userIds = [...new Set(logs.map((l) => l.userId).filter((v): v is string => !!v))]
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, nameAr: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))

    return list(
      logs.map((l) => ({
        ...l,
        user: l.userId ? (byId.get(l.userId) ?? null) : null,
      })),
      logs.length
    )
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}
