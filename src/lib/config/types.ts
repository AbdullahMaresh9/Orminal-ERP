// =============================================================================
// System Configuration — Core types
//
// The configuration layer follows one rule: **Configuration-as-Contract**.
// Every setting the system knows is declared exactly once in the registry
// (registry.ts) with its type, validator, safe default, scope, permission and
// — critically — the business-logic reader(s) that enforce it. The UI is
// generated from the registry; a screen can never drift from the server.
//
// A setting whose `enforcement.status` is not 'enforced' is rendered with an
// explicit "UI only — not yet enforced" badge. The governance test
// (tests/config-governance.test.ts) fails the build when an 'enforced'
// setting has no living reader, so enforcement claims cannot rot.
// =============================================================================

/** Wire type of a setting value (values are stored as strings in DB). */
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'select' | 'secret'

/**
 * Maximum granularity at which a value may be overridden.
 * Resolution order at read time: (company, branch) → (company, *) → (*, *) → registry default.
 * '*' is used instead of NULL — Postgres treats NULLs as distinct, which would
 * break the unique constraint (same rationale as ADR-CoA-001).
 */
export type ScopeLevel = 'global' | 'company' | 'branch'

export const GLOBAL_SCOPE = '*' as const

export type EnforcementStatus =
  /** Business logic actually reads this key; readBy lists the reader files. */
  | 'enforced'
  /** Persisted + audited, but no business logic consumes it yet. Shown with a badge. */
  | 'ui_only'

export interface ConfigEnforcement {
  status: EnforcementStatus
  /** Source files (repo-relative) that read this key. Verified by the governance test. */
  readBy?: string[]
  /** Which phase of the configuration program wires this key up (documentation only). */
  plannedPhase?: number
  /** Short human note about WHERE the setting takes effect. */
  effectAr?: string
  effectEn?: string
}

export interface NumberConstraints {
  min?: number
  max?: number
  integer?: boolean
}

export interface ConfigDef {
  key: string
  /** Category id — must exist in CONFIG_TREE (tree.ts). */
  category: string
  type: ConfigValueType
  labelAr: string
  labelEn: string
  descriptionAr?: string
  descriptionEn?: string
  /** Default value (string-encoded). Used when no row exists at any scope. */
  defaultValue: string
  /** Options for type 'select'. */
  options?: string[]
  scope: ScopeLevel
  /** System settings cannot be deleted and require config.manage capability. */
  isSystem?: boolean
  sortOrder?: number
  /** Secret values are AES-256-GCM encrypted at rest and masked on read. */
  secret?: boolean
  /** Extra validation for 'number' type. */
  number?: NumberConstraints
  /** Regex pattern (string form) for 'string' type. */
  pattern?: string
  enforcement: ConfigEnforcement
}

export interface ConfigScope {
  companyId: string
  branchId: string
}

export const DEFAULT_CONFIG_SCOPE: ConfigScope = { companyId: GLOBAL_SCOPE, branchId: GLOBAL_SCOPE }
