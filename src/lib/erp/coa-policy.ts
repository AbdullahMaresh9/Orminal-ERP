// Enterprise ERP — Chart of Accounts permission policy (pure, no framework deps).
// Kept separate from rbac.ts so the policy can be unit-tested without pulling in
// NextAuth, and so the same matrix can be reused by the seeding/migration script.

export type Capability =
  | 'canRead'
  | 'canCreate'
  | 'canUpdate'
  | 'canDelete'
  | 'canApprove'
  | 'canPost'
  | 'canExport'
  | 'canImport'
  | 'canPrint'

/** Chart-of-Accounts permission actions (module FIN). */
export const COA_ACTIONS = {
  /** View / create / edit / deactivate / import / export accounts. */
  ACCOUNTS: 'COA',
  /** View ledger + journal entries of an account. */
  LEDGER: 'COA_LEDGER',
  /** Manage account determination (role mappings) — high risk. */
  CONFIG: 'COA_CONFIG',
} as const

export type CoaAction = (typeof COA_ACTIONS)[keyof typeof COA_ACTIONS]

/**
 * Default policy, used ONLY when the RBAC catalog has no Permission row for the
 * action yet. '*' means every capability.
 * Failing closed would lock everyone out of a system whose permission catalog was
 * never populated; failing open would be a security hole. This documented matrix
 * is the middle ground, and the migration script provisions real DB rows so the
 * database becomes authoritative.
 */
export const DEFAULT_ROLE_MATRIX: Record<string, Partial<Record<CoaAction, Capability[] | '*'>>> = {
  ADMIN: { COA: '*', COA_LEDGER: '*', COA_CONFIG: '*' },
  CEO: { COA: ['canRead', 'canExport', 'canPrint'], COA_LEDGER: ['canRead'], COA_CONFIG: [] },
  FIN_MGR: { COA: '*', COA_LEDGER: '*', COA_CONFIG: '*' },
  CHIEF_ACC: {
    COA: ['canRead', 'canCreate', 'canUpdate', 'canDelete', 'canImport', 'canExport', 'canPrint'],
    COA_LEDGER: ['canRead'],
    COA_CONFIG: ['canRead', 'canUpdate'],
  },
  ACCOUNTANT: {
    COA: ['canRead', 'canCreate', 'canUpdate', 'canExport', 'canPrint'],
    COA_LEDGER: ['canRead'],
    COA_CONFIG: ['canRead'],
  },
  AUDITOR: { COA: ['canRead', 'canExport', 'canPrint'], COA_LEDGER: ['canRead'], COA_CONFIG: ['canRead'] },
  CASHIER: { COA: ['canRead'], COA_LEDGER: ['canRead'], COA_CONFIG: [] },
  VIEWER: { COA: ['canRead'], COA_LEDGER: [], COA_CONFIG: [] },
}

/** Roles absent from the matrix get read-only visibility of the chart. */
export const FALLBACK_POLICY: Partial<Record<CoaAction, Capability[]>> = {
  COA: ['canRead'],
  COA_LEDGER: [],
  COA_CONFIG: [],
}

export function matrixAllows(roleCode: string, action: CoaAction, capability: Capability): boolean {
  const policy = DEFAULT_ROLE_MATRIX[roleCode] ?? FALLBACK_POLICY
  const grant = policy[action]
  if (grant === '*') return true
  if (Array.isArray(grant)) return grant.includes(capability)
  return false
}
