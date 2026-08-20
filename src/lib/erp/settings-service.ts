// =============================================================================
// Enterprise ERP — Configuration Service (legacy compatibility facade)
//
// The canonical configuration layer now lives in src/lib/config/*:
//   - registry.ts  — the single source of truth for every setting
//   - resolve.ts   — scoped, cached reads
//   - service.ts   — validated, audited, transactional writes
//   - permissions.ts — CFG RBAC
//
// This module keeps the ORIGINAL public API (getSetting, saveSettings,
// DEFAULT_SETTINGS, seedDefaultSettings, …) so existing consumers —
// number-sequence.ts and the legacy /api/erp/settings route — keep working
// unchanged. New code should import from '@/lib/config/*' directly.
// =============================================================================

import { CONFIG_REGISTRY } from '@/lib/config/registry'
import {
  getConfig,
  getConfigNumber,
  getConfigBool,
  clearConfigCache,
} from '@/lib/config/resolve'
import { saveConfig, seedConfigDefaults } from '@/lib/config/service'
import { GLOBAL_SCOPE } from '@/lib/config/types'
import { db } from '@/lib/db'

// === Type-safe accessors (global scope — legacy callers are scope-unaware) ===

export async function getSetting(key: string, fallback: string = ''): Promise<string> {
  return getConfig(key, undefined, fallback)
}

export async function getSettingNumber(key: string, fallback: number = 0): Promise<number> {
  return getConfigNumber(key, undefined, fallback)
}

export async function getSettingBool(key: string, fallback: boolean = false): Promise<boolean> {
  return getConfigBool(key, undefined, fallback)
}

export async function getSettingsByPrefix(prefix: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const def of CONFIG_REGISTRY) {
    if (def.key.startsWith(prefix)) out[def.key] = await getConfig(def.key)
  }
  return out
}

export async function getSettingsByCategory(category: string): Promise<Record<string, string>> {
  try {
    const rows = await db.setting.findMany({ where: { category } })
    const out: Record<string, string> = {}
    for (const s of rows) out[s.key] = s.value
    return out
  } catch {
    return {}
  }
}

// === Writes (delegate to the validated, audited write path) ===

export async function saveSetting(
  key: string,
  value: string,
  userId?: string,
  reason?: string
): Promise<void> {
  await saveSettings({ [key]: value }, userId, reason)
}

export async function saveSettings(
  settings: Record<string, string>,
  userId?: string,
  reason?: string
): Promise<void> {
  const result = await saveConfig(
    settings,
    { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
    { userId: userId ?? 'system', reason }
  )
  if (!result.ok) {
    const msg =
      result.errors?.map((e) => e.messageAr).join('؛ ') ??
      result.ruleErrors?.map((e) => e.messageAr).join('؛ ') ??
      'فشل حفظ الإعدادات'
    throw new Error(msg)
  }
}

export function clearSettingsCache(): void {
  clearConfigCache()
}

// === Legacy metadata surface (derived from the registry) ===

export interface SettingDef {
  key: string
  value: string
  category: string
  label: string
  labelEn: string
  type: 'string' | 'number' | 'boolean' | 'select'
  defaultValue: string
  options?: string[]
  description?: string
  isSystem?: boolean
  sortOrder?: number
}

export const DEFAULT_SETTINGS: SettingDef[] = CONFIG_REGISTRY.map((d) => ({
  key: d.key,
  value: d.defaultValue,
  category: d.category,
  label: d.labelAr,
  labelEn: d.labelEn,
  type: d.type === 'secret' ? 'string' : d.type,
  defaultValue: d.defaultValue,
  options: d.options,
  description: d.descriptionAr,
  isSystem: d.isSystem,
  sortOrder: d.sortOrder,
}))

export async function seedDefaultSettings() {
  await seedConfigDefaults()
}
