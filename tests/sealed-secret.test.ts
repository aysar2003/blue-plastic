import { describe, expect, it } from 'vitest'

import { openSecret, sealSecret, sealedSecretsEqual } from '@/lib/sealed-secret'
import { matchSmtpPreset } from '@/lib/smtp-presets'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('sealed secret', () => {
  it('seals and opens plaintext', () => {
    const sealed = sealSecret('gmail-app-password', SECRET)
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(openSecret(sealed, SECRET)).toBe('gmail-app-password')
  })

  it('rejects a wrong secret or tampered blob', () => {
    const sealed = sealSecret('secret', SECRET)
    expect(openSecret(sealed, 'other-secret-that-is-at-least-32-chars!!')).toBeNull()
    const parts = sealed.split('.')
    parts[3] = `${parts[3].slice(0, -2)}AA`
    expect(openSecret(parts.join('.'), SECRET)).toBeNull()
    expect(openSecret('not-sealed', SECRET)).toBeNull()
  })

  it('compares equal sealed values', () => {
    const a = sealSecret('same', SECRET)
    const b = sealSecret('same', SECRET)
    expect(a).not.toBe(b)
    expect(sealedSecretsEqual(a, b, SECRET)).toBe(true)
    expect(sealedSecretsEqual(a, sealSecret('other', SECRET), SECRET)).toBe(false)
  })
})

describe('smtp presets', () => {
  it('matches gmail and outlook hosts', () => {
    expect(matchSmtpPreset('smtp.gmail.com', 465)).toBe('gmail')
    expect(matchSmtpPreset('smtp.office365.com', 587)).toBe('outlook')
    expect(matchSmtpPreset('mail.company.com', 587)).toBe('custom')
  })
})
