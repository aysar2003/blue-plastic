import { describe, expect, it } from 'vitest'

import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from '@/lib/totp'
import { createHmac } from 'node:crypto'

function hotpForTest(secretBase32: string, counter: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  const key = Buffer.from(out)
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

describe('totp', () => {
  it('generates base32 secrets and otpauth urls', () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBeGreaterThanOrEqual(16)
    const url = buildOtpAuthUrl({ secret, accountName: 'owner@example.com', issuer: 'SOM ERP' })
    expect(url.startsWith('otpauth://totp/')).toBe(true)
    expect(url).toContain(secret)
  })

  it('verifies the current step code', () => {
    const secret = generateTotpSecret()
    const step = Math.floor(Date.now() / 1000 / 30)
    const code = hotpForTest(secret, step)
    expect(verifyTotp(secret, code)).toBe(true)
    expect(verifyTotp(secret, '000000')).toBe(false)
  })
})
