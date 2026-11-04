import { describe, expect, it } from 'vitest'

import {
  LOGIN_TICKET_TTL_MS,
  openLoginTicket,
  openPreAuth,
  sealLoginTicket,
  sealPreAuth,
} from '@/lib/login-ticket'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('login tickets', () => {
  it('round-trips a login ticket', () => {
    const sealed = sealLoginTicket(
      { userId: 'user_1', audience: 'company', exp: Date.now() + LOGIN_TICKET_TTL_MS },
      SECRET,
    )
    const opened = openLoginTicket(sealed, SECRET)
    expect(opened?.userId).toBe('user_1')
    expect(opened?.audience).toBe('company')
  })

  it('rejects expired tickets', () => {
    const sealed = sealLoginTicket(
      { userId: 'user_1', audience: 'staff', exp: Date.now() - 1000 },
      SECRET,
    )
    expect(openLoginTicket(sealed, SECRET)).toBeNull()
  })

  it('round-trips preauth', () => {
    const sealed = sealPreAuth(
      {
        userId: 'user_1',
        challengeId: 'chal_1',
        audience: 'company',
        email: 'a@b.com',
        exp: Date.now() + 60_000,
      },
      SECRET,
    )
    expect(openPreAuth(sealed, SECRET)?.challengeId).toBe('chal_1')
  })
})
