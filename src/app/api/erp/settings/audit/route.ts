import { db } from '@/lib/db'
import { list, serverError } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const settingKey = url.searchParams.get('key')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

    const where: any = {}
    if (category) where.category = category
    if (settingKey) where.settingKey = settingKey

    const logs = await db.settingAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return list(logs, logs.length)
  } catch (e: any) {
    return serverError(e.message)
  }
}
