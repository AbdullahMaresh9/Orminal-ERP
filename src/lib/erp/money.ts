// Enterprise ERP — money & quantity helpers.
//
// Monetary and quantity columns are stored as SQL `Decimal` for exact precision
// at rest and in database-level aggregation (SUM/AVG). Prisma surfaces them as
// `Prisma.Decimal` objects, whose `+ - * /` operators do NOT do arithmetic.
// Business logic keeps computing in JS `number`; use `n()` to coerce a value
// coming out of the database at the edge, and `round2()` to snap to cents.
//
// Writes stay ergonomic: Prisma accepts a JS number for a Decimal column, so
// code that computes a total as a number and passes it to create()/update()
// needs no change.

import { Prisma } from '@prisma/client'

export type Numeric = number | string | Prisma.Decimal | null | undefined

/** Coerce any numeric-ish value (Decimal, string, number, null) to a JS number. */
export function n(v: Numeric): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const parsed = Number(v)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // Prisma.Decimal (or anything with toNumber)
  const anyv = v as { toNumber?: () => number }
  if (typeof anyv.toNumber === 'function') return anyv.toNumber()
  const parsed = Number(v as unknown as string)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Round to 2 decimal places (currency cents). */
export function round2(v: Numeric): number {
  return Math.round(n(v) * 100) / 100
}

/** Round to an arbitrary number of decimal places (default 6, for quantities). */
export function roundTo(v: Numeric, dp = 6): number {
  const f = 10 ** dp
  return Math.round(n(v) * f) / f
}

/** Sum a list by a numeric selector, coercing each element safely. */
export function sumBy<T>(items: readonly T[], sel: (t: T) => Numeric): number {
  return items.reduce((s, it) => s + n(sel(it)), 0)
}

/**
 * Recursively convert every Prisma.Decimal in a payload to a JS number so API
 * responses serialize as JSON numbers (not strings). Used by the response
 * envelope so no endpoint has to remember to coerce.
 */
export function decimalsToNumbers<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Prisma.Decimal.isDecimal(value as never)) {
    return (value as unknown as Prisma.Decimal).toNumber() as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => decimalsToNumbers(v)) as unknown as T
  }
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decimalsToNumbers(v)
    }
    return out as T
  }
  return value
}
