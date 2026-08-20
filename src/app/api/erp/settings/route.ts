// =============================================================================
// Legacy settings endpoint — kept for the existing settings UI and for
// app-wide reads (lib/export.ts fetches printing settings for every user).
//
// Hardened:
// - GET stays available to any AUTHENTICATED user (print/export needs it),
//   but secret values are masked — they are never returned in clear.
// - PUT/POST derive the acting user from the SESSION (previously: whatever
//   `db.user.findFirst({active:true})` returned — audit rows were fiction)
//   and require config capabilities.
// - All writes flow through the validated, audited write path (saveConfig).
// New tooling should prefer /api/erp/config.
// =============================================================================

import { db } from '@/lib/db'
import { ok, badRequest, serverError } from '@/lib/erp/api-response'
import { requireAuth, isAuthFailure } from '@/lib/erp/rbac'
import { requireConfigCapability } from '@/lib/config/permissions'
import { getConfigDef, SECRET_KEYS } from '@/lib/config/registry'
import { saveConfig, seedConfigDefaults } from '@/lib/config/service'
import { maskSecret, decryptSecret } from '@/lib/config/crypto'
import { GLOBAL_SCOPE } from '@/lib/config/types'

export async function GET(req: Request) {
  try {
    const auth = await requireAuth()
    if (isAuthFailure(auth)) return auth

    const url = new URL(req.url)
    const category = url.searchParams.get('category')

    // Sync DB rows with the registry (idempotent, cheap when in sync)
    const count = await db.setting.count({
      where: { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
    })
    if (count < 1) await seedConfigDefaults()

    const where = category ? { category } : {}
    const settings = await db.setting.findMany({ where, orderBy: { category: 'asc' } })

    const result: Record<string, unknown> = {}
    for (const s of settings) {
      const secret = SECRET_KEYS.has(s.key)
      result[s.key] = {
        value: secret ? maskSecret(decryptSecret(s.value)) : s.value,
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
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { settings: Record<string, string>; reason?: string }
    if (!body.settings || typeof body.settings !== 'object') {
      return badRequest('Invalid settings payload')
    }

    let needsSystem = false
    let needsSecret = false
    for (const key of Object.keys(body.settings)) {
      const def = getConfigDef(key)
      if (!def) return badRequest(`الإعداد «${key}» غير معرَّف في سجل النظام`, 'UNKNOWN_KEY')
      if (def.isSystem) needsSystem = true
      if (def.secret) needsSecret = true
    }
    const auth = await requireConfigCapability(
      needsSecret ? 'CONFIG_SECRET' : needsSystem ? 'CONFIG_SYSTEM' : 'CONFIG',
      'canUpdate'
    )
    if (isAuthFailure(auth)) return auth

    const result = await saveConfig(
      body.settings,
      { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
      {
        userId: auth.userId,
        reason: body.reason,
        ipAddress:
          req.headers.get('x-real-ip') ??
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      }
    )
    if (!result.ok) {
      return badRequest(
        result.errors?.map((e) => e.messageAr).join('؛ ') ??
          result.ruleErrors?.map((e) => e.messageAr).join('؛ ') ??
          'فشل التحقق من الإعدادات',
        'VALIDATION_FAILED'
      )
    }
    return ok({ success: true, count: result.saved })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}

// Reset a single setting to its default value
export async function POST(req: Request) {
  try {
    const { key } = (await req.json()) as { key?: string }
    if (!key) return badRequest('Key is required')

    const def = getConfigDef(key)
    if (!def) return badRequest('Setting not found')

    const auth = await requireConfigCapability(
      def.secret ? 'CONFIG_SECRET' : def.isSystem ? 'CONFIG_SYSTEM' : 'CONFIG',
      'canUpdate'
    )
    if (isAuthFailure(auth)) return auth

    const result = await saveConfig(
      { [key]: def.defaultValue },
      { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
      { userId: auth.userId, reason: 'Reset to default' }
    )
    if (!result.ok) return badRequest('تعذّرت إعادة التعيين', 'RESET_FAILED')
    return ok({ key, value: def.defaultValue })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}
