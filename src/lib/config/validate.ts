// =============================================================================
// System Configuration — per-key validation (server-side, registry-driven)
// Values travel as strings; each ConfigDef defines how its string must parse.
// =============================================================================

import { z } from 'zod'
import type { ConfigDef } from './types'

export interface ValidationFailure {
  key: string
  messageAr: string
  messageEn: string
}

export function buildValueSchema(def: ConfigDef): z.ZodType<string> {
  switch (def.type) {
    case 'boolean':
      return z.enum(['true', 'false'])
    case 'number': {
      return z.string().refine(
        (v) => {
          if (v.trim() === '') return false
          const n = Number(v)
          if (Number.isNaN(n)) return false
          const c = def.number
          if (c?.integer && !Number.isInteger(n)) return false
          if (c?.min !== undefined && n < c.min) return false
          if (c?.max !== undefined && n > c.max) return false
          return true
        },
        { message: 'invalid number' }
      )
    }
    case 'select': {
      const opts = def.options ?? []
      return z.string().refine((v) => opts.includes(v), { message: 'not an allowed option' })
    }
    case 'secret':
      return z.string().max(10_000)
    case 'string':
    default: {
      let s = z.string().max(10_000)
      if (def.pattern) {
        const re = new RegExp(def.pattern)
        s = s.refine((v) => v === '' || re.test(v), { message: 'pattern mismatch' }) as never
      }
      return s
    }
  }
}

export function validateValue(def: ConfigDef, value: string): ValidationFailure | null {
  const res = buildValueSchema(def).safeParse(value)
  if (res.success) return null
  const c = def.number
  let hintAr = ''
  let hintEn = ''
  if (def.type === 'number') {
    const range = [
      c?.min !== undefined ? `≥ ${c.min}` : '',
      c?.max !== undefined ? `≤ ${c.max}` : '',
      c?.integer ? 'عدد صحيح' : '',
    ]
      .filter(Boolean)
      .join('، ')
    hintAr = `يجب أن تكون قيمة رقمية${range ? ` (${range})` : ''}`
    hintEn = `must be numeric${range ? ` (${range})` : ''}`
  } else if (def.type === 'select') {
    hintAr = `القيم المسموحة: ${(def.options ?? []).join('، ')}`
    hintEn = `allowed: ${(def.options ?? []).join(', ')}`
  } else if (def.type === 'boolean') {
    hintAr = 'القيم المسموحة: true أو false'
    hintEn = 'allowed: true or false'
  } else {
    hintAr = 'قيمة غير صالحة'
    hintEn = 'invalid value'
  }
  return {
    key: def.key,
    messageAr: `«${def.labelAr}»: ${hintAr}`,
    messageEn: `"${def.labelEn}": ${hintEn}`,
  }
}
