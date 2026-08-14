import { scrypt, timingSafeEqual, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 64

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey as Buffer)
    })
  })
}

/**
 * Hashes a plaintext password using scrypt. This is the canonical format
 * for all passwords going forward (`scrypt:N:r:p$saltHex$hashHex`).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

/**
 * Verifies a plaintext password against a stored hash.
 *
 * Historical data in this project contains three formats:
 * - `scrypt:N:r:p$salt$hash` — the current, secure format produced by hashPassword().
 * - `$2a$`/`$2b$`/`$2y$...` — bcrypt hashes from an earlier seeding pass.
 * - `hashed$<base64>` — a legacy, INSECURE pseudo-hash that is just the
 *   plaintext password base64-encoded. Treated as a legacy format purely to
 *   allow existing accounts to log in; every login through this path is
 *   flagged for immediate migration to scrypt.
 *
 * Returns whether the password matched and whether the stored hash should be
 * upgraded to the current scrypt format (i.e. it was not already scrypt).
 */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  try {
    if (hash.startsWith('scrypt:')) {
      const [params, salt, storedHash] = hash.split('$')
      const [, N, r, p] = params.split(':').map(Number)
      const derivedKey = await scryptAsync(plaintext, Buffer.from(salt, 'hex'), 64, { N, r, p })
      const storedBuf = Buffer.from(storedHash, 'hex')
      const valid = derivedKey.length === storedBuf.length && timingSafeEqual(derivedKey, storedBuf)
      return { valid, needsRehash: false }
    }

    if (/^\$2[aby]\$/.test(hash)) {
      const valid = await bcrypt.compare(plaintext, hash)
      return { valid, needsRehash: valid }
    }

    if (hash.startsWith('hashed$')) {
      const decoded = Buffer.from(hash.slice('hashed$'.length), 'base64').toString('utf8')
      const valid = decoded === plaintext
      return { valid, needsRehash: valid }
    }

    // Unknown format: never match.
    return { valid: false, needsRehash: false }
  } catch {
    return { valid: false, needsRehash: false }
  }
}
