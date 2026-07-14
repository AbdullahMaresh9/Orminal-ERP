import { db } from '@/lib/db'
import { ok, badRequest, serverError, list } from '@/lib/erp/api-response'
import { saveSettings, seedDefaultSettings, DEFAULT_SETTINGS } from '@/lib/erp/settings-service'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const category = url.searchParams.get('category')

    // If no settings exist, seed defaults first
    const count = await db.setting.count()
    if (count === 0) {
      await seedDefaultSettings()
    }

    const where = category ? { category } : {}
    const settings = await db.setting.findMany({ where, orderBy: { category: 'asc' } })

    // Return as flat key-value map + metadata
    const result: Record<string, any> = {}
    for (const s of settings) {
      result[s.key] = {
        value: s.value,
        category: s.category,
        label: s.label,
        labelEn: s.labelEn,
        type: s.type,
        defaultValue: s.defaultValue,
        options: s.options ? JSON.parse(s.options) : null,
        isSystem: s.isSystem,
      }
    }

    return ok(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { settings, reason } = body as { settings: Record<string, string>; reason?: string }

    if (!settings || typeof settings !== 'object') {
      return badRequest('Invalid settings payload')
    }

    // Get user from session (simplified — in production use NextAuth)
    const user = await db.user.findFirst({ where: { active: true } })

    await saveSettings(settings, user?.id, reason)

    return ok({ success: true, count: Object.keys(settings).length })
  } catch (e: any) {
    return serverError(e.message)
  }
}

// Reset a single setting to its default value
export async function POST(req: Request) {
  try {
    const { key } = await req.json()
    if (!key) return badRequest('Key is required')

    const setting = await db.setting.findUnique({ where: { key } })
    if (!setting) return badRequest('Setting not found')
    if (!setting.defaultValue) return badRequest('No default value defined')

    const user = await db.user.findFirst({ where: { active: true } })
    await saveSettings({ [key]: setting.defaultValue }, user?.id, 'Reset to default')

    return ok({ key, value: setting.defaultValue })
  } catch (e: any) {
    return serverError(e.message)
  }
}
