import { describe, expect, it } from 'vitest'

import {
  AUTH_OTP_EXPIRY_MINUTES,
  authOtpEmailHtml,
  authOtpEmailSubject,
  authOtpEmailText,
  formatOtpDisplay,
} from '@/lib/auth-otp-email'

describe('formatOtpDisplay', () => {
  it('spaces a 6-digit code in the middle', () => {
    expect(formatOtpDisplay('863641')).toBe('863 641')
  })

  it('spaces an 8-digit code in the middle', () => {
    expect(formatOtpDisplay('12345678')).toBe('1234 5678')
  })
})

describe('authOtpEmailSubject', () => {
  it('puts the spaced code first for notification autofill', () => {
    expect(authOtpEmailSubject('863641', 'SOM ERP')).toBe(
      '863 641 is your SOM ERP sign-in code',
    )
  })
})

describe('authOtpEmailText', () => {
  it('keeps a plain-text fallback with expiry and security note', () => {
    const text = authOtpEmailText('863641')
    expect(text).toContain('863641')
    expect(text).toContain(`${AUTH_OTP_EXPIRY_MINUTES} minutes`)
    expect(text).toContain('Never share this code')
    expect(text).toContain('ignore this email')
  })
})

describe('authOtpEmailHtml', () => {
  it('renders a luxury HTML body with digit boxes and no script tags', () => {
    const html = authOtpEmailHtml('863641')
    expect(html).toContain('Your sign-in code')
    expect(html).toContain('SOM ERP')
    expect(html).toContain('863641')
    expect(html).toContain('will never ask for this code')
    expect(html).toContain('Sign-in verification')
    expect(html).toContain('Copy code')
    expect(html).toContain('user-select:all')
    expect(html).not.toContain('<script')
    // Each digit rendered in its own cell
    for (const digit of '863641') {
      expect(html).toContain(`>${digit}</div>`)
    }
  })

  it('escapes product name HTML', () => {
    const html = authOtpEmailHtml('111111', 'Acme <script>')
    expect(html).toContain('Acme &lt;script&gt;')
    expect(html).not.toContain('Acme <script>')
  })
})
