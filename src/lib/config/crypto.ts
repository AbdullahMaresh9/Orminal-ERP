// =============================================================================
// System Configuration — secret encryption at rest
//
// Secret settings (SMTP password, ZATCA API key, …) were previously stored as
// plaintext in Setting.value. They are now AES-256-GCM encrypted with a key
// from CONFIG_ENCRYPTION_KEY (32-byte hex, see .env.example).
//
// Storage format:  enc:v1:<iv hex>:<auth tag hex>:<ciphertext hex>
// - A value NOT starting with `enc:` is treated as legacy plaintext and is
//   re-encrypted transparently on the next save.
// - decryptSecret never throws to callers on bad input; it returns '' and the
//   caller decides how to surface the failure.
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const hex = process.env.CONFIG_ENCRYPTION_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) return null
  return Buffer.from(hex, 'hex')
}

/** True when the environment is configured for secret encryption. */
export function encryptionAvailable(): boolean {
  return getKey() !== null
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encryptSecret(plaintext: string): string {
  if (plaintext === '') return ''
  const key = getKey()
  if (!key) {
    throw new Error(
      'CONFIG_ENCRYPTION_KEY is not set (32-byte hex). Secret settings cannot be saved without it.'
    )
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decryptSecret(stored: string): string {
  if (stored === '') return ''
  if (!isEncrypted(stored)) return stored // legacy plaintext
  const key = getKey()
  if (!key) return ''
  try {
    const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
      'utf8'
    )
  } catch {
    return ''
  }
}

/** Mask for returning secrets to the UI: keeps first 2 + last 2 chars. */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return ''
  if (plaintext.length <= 6) return '••••'
  return `${plaintext.slice(0, 2)}••••${plaintext.slice(-2)}`
}
