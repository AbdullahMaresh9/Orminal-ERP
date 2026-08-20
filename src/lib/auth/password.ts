// Shared password hashing (scrypt).
// Single source of truth for producing password hashes. The verifier lives in
// auth-options.ts (verifyPassword) and accepts ONLY this format:
//   scrypt:N:r:p$<salt hex>$<derived key hex>
// Any other stored format (legacy `hashed$<base64>`) can never authenticate,
// so every write path MUST use hashPassword() from this module.

import { scrypt, randomBytes } from 'crypto'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

function scryptAsync(
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

/** Minimum password policy enforced server-side (configurable length comes from settings). */
export function validatePasswordStrength(
  password: string,
  opts?: { minLength?: number; requireSpecial?: boolean }
): { ok: true } | { ok: false; message: string } {
  const minLength = opts?.minLength ?? 8
  if (password.length < minLength) {
    return { ok: false, message: `كلمة المرور يجب أن تكون ${minLength} أحرف على الأقل` }
  }
  if (opts?.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    return { ok: false, message: 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل' }
  }
  return { ok: true }
}
