import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Generate a 20-byte secret as base32 (Authenticator-compatible). */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20)
  return base32Encode(bytes)
}

export function buildOtpAuthUrl(input: {
  secret: string
  accountName: string
  issuer?: string
}): string {
  const issuer = input.issuer ?? 'SOM ERP'
  const label = encodeURIComponent(`${issuer}:${input.accountName}`)
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Verify a 6-digit TOTP with ±1 step window. */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) return false

  const key = base32Decode(secret)
  if (!key) return false

  const step = Math.floor(now / 1000 / 30)
  for (const offset of [-1, 0, 1]) {
    const expected = hotp(key, step + offset)
    if (equalDigits(expected, trimmed)) return true
  }
  return false
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input: string): Buffer | null {
  const cleaned = input.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  if (!cleaned) return null

  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function equalDigits(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
