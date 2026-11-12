import { describe, expect, it } from 'vitest'

import { isPublicApiPath } from '@/lib/public-api'

describe('isPublicApiPath', () => {
  it('allows machine and health doors', () => {
    expect(isPublicApiPath('/api/health')).toBe(true)
    expect(isPublicApiPath('/api/auth/callback/credentials')).toBe(true)
    expect(isPublicApiPath('/api/v1/openapi')).toBe(true)
    expect(isPublicApiPath('/api/v1/capabilities')).toBe(true)
    expect(isPublicApiPath('/api/cron/recurring')).toBe(true)
    expect(isPublicApiPath('/api/attendance/punches')).toBe(true)
    expect(isPublicApiPath('/api/portal/logo')).toBe(true)
  })

  it('requires a session for app APIs', () => {
    expect(isPublicApiPath('/api/search')).toBe(false)
    expect(isPublicApiPath('/api/backup')).toBe(false)
    expect(isPublicApiPath('/api/print/html-pdf')).toBe(false)
  })
})
