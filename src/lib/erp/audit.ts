// Enterprise ERP — Audit helper
// Writes an immutable AuditLog row for sensitive changes: who, when, action,
// old value, new value, reason. Audit rows are append-only; no API exposes an
// update/delete path for them.

import { db } from '@/lib/db'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'deactivate'
  | 'reactivate'
  | 'post'
  | 'reverse'
  | 'cancel'
  | 'approve'
  | 'import'
  | 'export'
  | 'configure'

export interface AuditInput {
  userId?: string | null
  companyId?: string | null
  moduleCode: string
  documentType: string
  documentId?: string | null
  action: AuditAction
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  correlationId?: string | null
}

/** Only keep the fields that actually changed, so the diff stays readable. */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: Partial<T>,
  fields?: readonly (keyof T)[]
): { old: Partial<T>; new: Partial<T>; changed: (keyof T)[] } {
  const keys = (fields ?? (Object.keys(after) as (keyof T)[])) as (keyof T)[]
  const oldOut: Partial<T> = {}
  const newOut: Partial<T> = {}
  const changed: (keyof T)[] = []
  for (const k of keys) {
    const b = before ? before[k] : undefined
    const a = after[k]
    if (a === undefined) continue
    if (JSON.stringify(b ?? null) !== JSON.stringify(a ?? null)) {
      oldOut[k] = b as T[keyof T]
      newOut[k] = a as T[keyof T]
      changed.push(k)
    }
  }
  return { old: oldOut, new: newOut, changed }
}

function serialize(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/**
 * Write an audit row. Never throws — a failed audit write must not roll back or
 * mask the business operation, but it is logged loudly.
 * Pass `tx` to make the audit row part of an enclosing transaction.
 */
export async function writeAudit(input: AuditInput, tx?: { auditLog: { create: (args: any) => Promise<unknown> } }): Promise<void> {
  const client = tx ?? db
  try {
    await client.auditLog.create({
      data: {
        userId: input.userId ?? null,
        companyId: input.companyId ?? null,
        moduleCode: input.moduleCode,
        documentType: input.documentType,
        documentId: input.documentId ?? null,
        action: input.action,
        oldValue: serialize(input.oldValue),
        newValue: serialize(input.newValue),
        reason: input.reason ?? null,
        correlationId: input.correlationId ?? null,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write audit log', { moduleCode: input.moduleCode, action: input.action, error: e })
  }
}

/** Convenience wrapper for Chart-of-Accounts audit rows. */
export async function auditAccount(args: {
  userId?: string | null
  companyId?: string | null
  accountId?: string | null
  action: AuditAction
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
}): Promise<void> {
  return writeAudit({
    userId: args.userId,
    companyId: args.companyId,
    moduleCode: 'FIN',
    documentType: 'account',
    documentId: args.accountId,
    action: args.action,
    oldValue: args.oldValue,
    newValue: args.newValue,
    reason: args.reason,
  })
}
