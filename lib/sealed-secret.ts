import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Reversible seal for org credentials (SMTP passwords).
 * Key is derived from AUTH_SECRET; ciphertext is versioned and authenticated (AES-256-GCM).
 */
const VERSION = 'v1'

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(`sealed-secret:v1:${secret}`).digest()
}

/** Seal plaintext for storage. Never log the result's payload. */
export function sealSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12)
  const key = keyFromSecret(secret)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.')
}

/** Open a sealed value, or null if forged / wrong secret / malformed. */
export function openSecret(sealed: string, secret: string): string | null {
  const parts = sealed.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  const [, ivB64, tagB64, encB64] = parts
  try {
    const iv = Buffer.from(ivB64, 'base64url')
    const tag = Buffer.from(tagB64, 'base64url')
    const enc = Buffer.from(encB64, 'base64url')
    if (iv.length !== 12 || tag.length !== 16) return null
    const key = keyFromSecret(secret)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** True when two sealed blobs decrypt to the same secret (constant-time on plaintext). */
export function sealedSecretsEqual(a: string, b: string, secret: string): boolean {
  const left = openSecret(a, secret)
  const right = openSecret(b, secret)
  if (left === null || right === null) return false
  const x = Buffer.from(left)
  const y = Buffer.from(right)
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}
