// =============================================================================
// System Configuration — write path
//
// ALL configuration writes flow through saveConfig():
//   1. every key must exist in the registry (unknown keys are rejected)
//   2. per-key validation (validate.ts) — type, range, options, pattern
//   3. cross-setting consistency rules (rules.ts) on the EFFECTIVE values
//   4. secrets are AES-256-GCM encrypted before touching the DB
//   5. value + audit row are written in ONE transaction per key batch
//   6. the audit row records the acting user (from the session — never
//      client-supplied), scope, ip and user-agent
//
// seedConfigDefaults() syncs the DB with the registry (global scope rows) and
// removes deprecated keys. Idempotent.
// =============================================================================

import { db } from '@/lib/db'
import { CONFIG_REGISTRY, DEPRECATED_KEYS, getConfigDef } from './registry'
import { validateValue, type ValidationFailure } from './validate'
import { CONFIG_RULES } from './rules'
import { encryptSecret, isEncrypted } from './crypto'
import { clearConfigCache } from './resolve'
import { GLOBAL_SCOPE, type ConfigScope } from './types'

export interface SaveContext {
  userId: string
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export interface SaveResult {
  ok: boolean
  saved: number
  errors?: ValidationFailure[]
  ruleErrors?: { id: string; messageAr: string; messageEn: string }[]
}

export async function saveConfig(
  changes: Record<string, string>,
  scope: ConfigScope,
  ctx: SaveContext
): Promise<SaveResult> {
  const keys = Object.keys(changes)
  if (!keys.length) return { ok: true, saved: 0 }

  // 1+2 — registry membership + per-key validation
  const errors: ValidationFailure[] = []
  for (const key of keys) {
    const def = getConfigDef(key)
    if (!def) {
      errors.push({
        key,
        messageAr: `الإعداد «${key}» غير معرَّف في سجل النظام`,
        messageEn: `Setting "${key}" is not defined in the system registry`,
      })
      continue
    }
    if (def.scope === 'global' && scope.companyId !== GLOBAL_SCOPE) {
      errors.push({
        key,
        messageAr: `«${def.labelAr}» إعداد عام على مستوى النظام ولا يقبل تخصيصاً لشركة أو فرع`,
        messageEn: `"${def.labelEn}" is system-global and cannot be overridden per company/branch`,
      })
      continue
    }
    if (def.scope === 'company' && scope.branchId !== GLOBAL_SCOPE) {
      errors.push({
        key,
        messageAr: `«${def.labelAr}» يُضبط على مستوى الشركة ولا يقبل تخصيصاً لفرع`,
        messageEn: `"${def.labelEn}" is company-level and cannot be overridden per branch`,
      })
      continue
    }
    const fail = validateValue(def, changes[key])
    if (fail) errors.push(fail)
  }
  if (errors.length) return { ok: false, saved: 0, errors }

  // 3 — cross-setting rules against effective values (current + proposed)
  const ruleKeys = new Set<string>()
  for (const r of CONFIG_RULES) for (const k of r.keys) ruleKeys.add(k)
  const effective: Record<string, string> = {}
  if (ruleKeys.size) {
    const current = await db.setting.findMany({
      where: { key: { in: [...ruleKeys] } },
      select: { key: true, value: true, companyId: true, branchId: true },
    })
    const rank = (r: { companyId: string; branchId: string }) =>
      (r.companyId === GLOBAL_SCOPE ? 0 : 2) + (r.branchId === GLOBAL_SCOPE ? 0 : 1)
    current
      .filter(
        (r) =>
          (r.companyId === GLOBAL_SCOPE || r.companyId === scope.companyId) &&
          (r.branchId === GLOBAL_SCOPE || r.branchId === scope.branchId)
      )
      .sort((a, b) => rank(a) - rank(b))
      .forEach((r) => (effective[r.key] = r.value))
    for (const k of ruleKeys) {
      if (effective[k] === undefined) effective[k] = getConfigDef(k)?.defaultValue ?? ''
    }
    Object.assign(effective, changes)
  }
  const ruleErrors: { id: string; messageAr: string; messageEn: string }[] = []
  for (const rule of CONFIG_RULES) {
    if (!rule.keys.some((k) => k in changes)) continue
    const err = rule.check(effective)
    if (err) ruleErrors.push({ id: rule.id, ...err })
  }
  if (ruleErrors.length) return { ok: false, saved: 0, ruleErrors }

  // 4+5+6 — write values + audit atomically
  let saved = 0
  await db.$transaction(async (tx) => {
    for (const key of keys) {
      const def = getConfigDef(key)!
      let value = changes[key]
      if (def.secret && value !== '' && !isEncrypted(value)) {
        value = encryptSecret(value)
      }
      const where = {
        key_companyId_branchId: {
          key,
          companyId: scope.companyId,
          branchId: scope.branchId,
        },
      }
      const existing = await tx.setting.findUnique({ where, select: { value: true } })
      if (existing?.value === value) continue

      await tx.setting.upsert({
        where,
        update: { value },
        create: {
          key,
          companyId: scope.companyId,
          branchId: scope.branchId,
          value,
          category: def.category,
          label: def.labelAr,
          labelEn: def.labelEn,
          type: def.type === 'secret' ? 'string' : def.type,
          defaultValue: def.defaultValue,
          options: def.options ? JSON.stringify(def.options) : null,
          isSystem: def.isSystem ?? false,
          sortOrder: def.sortOrder ?? 0,
        },
      })
      await tx.settingAuditLog.create({
        data: {
          settingKey: key,
          // never log secret material
          oldValue: def.secret ? (existing ? '•••' : null) : (existing?.value ?? null),
          newValue: def.secret ? '•••' : value,
          userId: ctx.userId,
          companyId: scope.companyId,
          branchId: scope.branchId,
          category: def.category,
          reason: ctx.reason ?? null,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      })
      saved++
    }
  })

  clearConfigCache()
  return { ok: true, saved }
}

/** Reset a key at a scope: delete the override row (value falls back up the chain). */
export async function resetConfig(
  key: string,
  scope: ConfigScope,
  ctx: SaveContext
): Promise<{ ok: boolean; messageAr?: string }> {
  const def = getConfigDef(key)
  if (!def) return { ok: false, messageAr: `الإعداد «${key}» غير معرَّف` }
  const where = {
    key_companyId_branchId: { key, companyId: scope.companyId, branchId: scope.branchId },
  }
  await db.$transaction(async (tx) => {
    const existing = await tx.setting.findUnique({ where, select: { value: true } })
    if (!existing) return
    await tx.setting.delete({ where })
    await tx.settingAuditLog.create({
      data: {
        settingKey: key,
        oldValue: def.secret ? '•••' : existing.value,
        newValue: null,
        userId: ctx.userId,
        companyId: scope.companyId,
        branchId: scope.branchId,
        category: def.category,
        reason: ctx.reason ?? 'إعادة تعيين إلى الافتراضي',
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    })
  })
  clearConfigCache()
  return { ok: true }
}

/**
 * Sync DB with registry at global scope: create missing rows with defaults,
 * refresh metadata columns, delete deprecated keys. Idempotent.
 */
export async function seedConfigDefaults(): Promise<{ created: number; removed: number }> {
  let created = 0
  const existing = await db.setting.findMany({
    where: { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
    select: { key: true, label: true, labelEn: true },
  })
  const have = new Map(existing.map((s) => [s.key, s]))

  for (const def of CONFIG_REGISTRY) {
    const row = have.get(def.key)
    const meta = {
      category: def.category,
      label: def.labelAr,
      labelEn: def.labelEn,
      type: def.type === 'secret' ? 'string' : def.type,
      defaultValue: def.defaultValue,
      options: def.options ? JSON.stringify(def.options) : null,
      isSystem: def.isSystem ?? false,
      sortOrder: def.sortOrder ?? 0,
    }
    if (!row) {
      await db.setting.create({
        data: {
          key: def.key,
          companyId: GLOBAL_SCOPE,
          branchId: GLOBAL_SCOPE,
          value: def.defaultValue,
          ...meta,
        },
      })
      created++
    } else if (row.label !== def.labelAr || row.labelEn !== def.labelEn) {
      await db.setting.update({
        where: {
          key_companyId_branchId: {
            key: def.key,
            companyId: GLOBAL_SCOPE,
            branchId: GLOBAL_SCOPE,
          },
        },
        data: meta,
      })
    }
  }

  const removed = await db.setting.deleteMany({ where: { key: { in: DEPRECATED_KEYS } } })
  if (created || removed.count) clearConfigCache()
  return { created, removed: removed.count }
}
