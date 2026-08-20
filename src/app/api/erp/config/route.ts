// =============================================================================
// System Configuration API — the configuration center's management endpoint
//
// GET  /api/erp/config?companyId=&branchId=
//   → tree + registry metadata + resolved values at the requested scope
//     (secrets masked, never returned in clear). Requires CONFIG canRead.
//
// PUT  /api/erp/config   { changes: { key: value }, scope?, reason? }
//   → validated, audited save. Capability escalates with what is touched:
//     ordinary keys → CONFIG canUpdate
//     isSystem keys → CONFIG_SYSTEM canUpdate
//     secret keys   → CONFIG_SECRET canUpdate
//     Acting user comes from the session — NEVER from the payload.
//
// POST /api/erp/config   { action: 'reset', key, scope? }
//   → removes the override at that scope (falls back up the chain).
// =============================================================================

import { ok, badRequest, serverError } from '@/lib/erp/api-response'
import { CONFIG_REGISTRY, getConfigDef } from '@/lib/config/registry'
import { CONFIG_TREE } from '@/lib/config/tree'
import { getConfig } from '@/lib/config/resolve'
import { saveConfig, resetConfig, seedConfigDefaults } from '@/lib/config/service'
import { maskSecret } from '@/lib/config/crypto'
import { GLOBAL_SCOPE, type ConfigScope } from '@/lib/config/types'
import {
  requireConfigCapability,
  seedConfigPermissions,
} from '@/lib/config/permissions'
import { isAuthFailure } from '@/lib/erp/rbac'

function parseScope(url: URL): ConfigScope {
  return {
    companyId: url.searchParams.get('companyId') || GLOBAL_SCOPE,
    branchId: url.searchParams.get('branchId') || GLOBAL_SCOPE,
  }
}

function requestMeta(req: Request) {
  return {
    ipAddress:
      req.headers.get('x-real-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireConfigCapability('CONFIG', 'canRead')
    if (isAuthFailure(auth)) return auth

    // Idempotent sync: registry rows + CFG permission catalog
    await seedConfigDefaults()
    await seedConfigPermissions()

    const url = new URL(req.url)
    const scope = parseScope(url)
    const category = url.searchParams.get('category')

    const defs = category
      ? CONFIG_REGISTRY.filter((d) => d.category === category)
      : CONFIG_REGISTRY

    const values: Record<string, { value: string; isSecret: boolean; hasValue: boolean }> = {}
    for (const def of defs) {
      const raw = await getConfig(def.key, scope)
      values[def.key] = def.secret
        ? { value: maskSecret(raw), isSecret: true, hasValue: raw !== '' }
        : { value: raw, isSecret: false, hasValue: raw !== '' }
    }

    return ok({
      tree: CONFIG_TREE,
      scope,
      definitions: defs.map((d) => ({
        key: d.key,
        category: d.category,
        type: d.type,
        labelAr: d.labelAr,
        labelEn: d.labelEn,
        descriptionAr: d.descriptionAr,
        descriptionEn: d.descriptionEn,
        defaultValue: d.secret ? '' : d.defaultValue,
        options: d.options,
        scope: d.scope,
        isSystem: d.isSystem ?? false,
        secret: d.secret ?? false,
        number: d.number,
        sortOrder: d.sortOrder ?? 0,
        enforcement: d.enforcement,
      })),
      values,
    })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      changes?: Record<string, string>
      scope?: Partial<ConfigScope>
      reason?: string
    }
    if (!body.changes || typeof body.changes !== 'object' || !Object.keys(body.changes).length) {
      return badRequest('لا توجد تغييرات للحفظ', 'EMPTY_CHANGES')
    }

    // Escalating capability based on what is touched
    let needsSystem = false
    let needsSecret = false
    for (const key of Object.keys(body.changes)) {
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
    if (needsSecret && needsSystem) {
      const sys = await requireConfigCapability('CONFIG_SYSTEM', 'canUpdate')
      if (isAuthFailure(sys)) return sys
    }

    const scope: ConfigScope = {
      companyId: body.scope?.companyId || GLOBAL_SCOPE,
      branchId: body.scope?.branchId || GLOBAL_SCOPE,
    }
    const result = await saveConfig(body.changes, scope, {
      userId: auth.userId,
      reason: body.reason,
      ...requestMeta(req),
    })
    if (!result.ok) {
      return badRequest(
        result.errors?.map((e) => e.messageAr).join('؛ ') ??
          result.ruleErrors?.map((e) => e.messageAr).join('؛ ') ??
          'فشل التحقق من الإعدادات',
        'VALIDATION_FAILED',
      )
    }
    return ok({ saved: result.saved })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string
      key?: string
      scope?: Partial<ConfigScope>
    }
    if (body.action !== 'reset' || !body.key) {
      return badRequest('الإجراء غير معروف — المتاح: reset مع key', 'UNKNOWN_ACTION')
    }
    const def = getConfigDef(body.key)
    if (!def) return badRequest(`الإعداد «${body.key}» غير معرَّف`, 'UNKNOWN_KEY')

    const auth = await requireConfigCapability(
      def.secret ? 'CONFIG_SECRET' : def.isSystem ? 'CONFIG_SYSTEM' : 'CONFIG',
      'canUpdate'
    )
    if (isAuthFailure(auth)) return auth

    const scope: ConfigScope = {
      companyId: body.scope?.companyId || GLOBAL_SCOPE,
      branchId: body.scope?.branchId || GLOBAL_SCOPE,
    }
    const result = await resetConfig(body.key, scope, {
      userId: auth.userId,
      reason: 'إعادة تعيين إلى الافتراضي',
      ...requestMeta(req),
    })
    if (!result.ok) return badRequest(result.messageAr ?? 'تعذّرت إعادة التعيين', 'RESET_FAILED')
    return ok({ reset: body.key })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unexpected error')
  }
}
