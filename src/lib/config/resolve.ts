// =============================================================================
// System Configuration — scoped reader
//
// getConfig(key, scope) resolves a setting with precedence:
//   (companyId, branchId) → (companyId, '*') → ('*', '*') → registry default
//
// A single DB read loads ALL rows for the scope chain into a per-scope cache
// (60s TTL) — business logic can call getConfig freely inside a request
// without N queries. saveConfig() invalidates the cache.
//
// Secrets: getConfig returns the DECRYPTED value (for server-side use such as
// SMTP). Never return getConfig() output of a secret key to a client — the
// API layer masks secrets via maskSecret().
// =============================================================================

import { db } from '@/lib/db'
import { getConfigDef } from './registry'
import { decryptSecret } from './crypto'
import { GLOBAL_SCOPE, type ConfigScope } from './types'

interface CacheEntry {
  values: Map<string, string> // key -> resolved raw value
  expires: number
}

const CACHE_TTL = 60 * 1000
const cache = new Map<string, CacheEntry>()

function scopeCacheId(scope: ConfigScope): string {
  return `${scope.companyId}::${scope.branchId}`
}

export function clearConfigCache(): void {
  cache.clear()
}

async function loadScope(scope: ConfigScope): Promise<Map<string, string>> {
  const id = scopeCacheId(scope)
  const hit = cache.get(id)
  if (hit && Date.now() < hit.expires) return hit.values

  const values = new Map<string, string>()
  try {
    const rows = await db.setting.findMany({
      where: {
        OR: [
          { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE },
          ...(scope.companyId !== GLOBAL_SCOPE
            ? [{ companyId: scope.companyId, branchId: GLOBAL_SCOPE }]
            : []),
          ...(scope.companyId !== GLOBAL_SCOPE && scope.branchId !== GLOBAL_SCOPE
            ? [{ companyId: scope.companyId, branchId: scope.branchId }]
            : []),
        ],
      },
      select: { key: true, value: true, companyId: true, branchId: true },
    })
    // Precedence: most specific wins. Sort so specific rows apply last.
    const rank = (r: { companyId: string; branchId: string }) =>
      (r.companyId === GLOBAL_SCOPE ? 0 : 2) + (r.branchId === GLOBAL_SCOPE ? 0 : 1)
    rows.sort((a, b) => rank(a) - rank(b))
    for (const r of rows) values.set(r.key, r.value)
  } catch {
    // DB unavailable (e.g. during build) — fall through to registry defaults.
  }
  cache.set(id, { values, expires: Date.now() + CACHE_TTL })
  return values
}

/** Resolve a config value. Secrets are decrypted. Unknown keys return fallback ?? ''. */
export async function getConfig(
  key: string,
  scope?: Partial<ConfigScope>,
  fallback?: string
): Promise<string> {
  const def = getConfigDef(key)
  const s: ConfigScope = {
    companyId: scope?.companyId ?? GLOBAL_SCOPE,
    branchId: scope?.branchId ?? GLOBAL_SCOPE,
  }
  const values = await loadScope(s)
  let raw = values.get(key)
  if (raw === undefined) raw = def?.defaultValue ?? fallback ?? ''
  if (def?.secret) return decryptSecret(raw)
  return raw
}

export async function getConfigNumber(
  key: string,
  scope?: Partial<ConfigScope>,
  fallback = 0
): Promise<number> {
  const n = Number(await getConfig(key, scope))
  return Number.isNaN(n) ? fallback : n
}

export async function getConfigBool(
  key: string,
  scope?: Partial<ConfigScope>,
  fallback = false
): Promise<boolean> {
  const v = await getConfig(key, scope)
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

/** Load many keys at once (single scope-chain query). Secrets decrypted. */
export async function getConfigBundle(
  keys: string[],
  scope?: Partial<ConfigScope>
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const k of keys) out[k] = await getConfig(k, scope) // loadScope caches → 1 query
  return out
}
