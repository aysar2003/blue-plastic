import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  LOGIN_TICKET_TTL_MS,
  newLoginTicketJti,
  openLoginTicket,
  openPreAuth,
  sealLoginTicket,
  sealPreAuth,
} from '@/lib/login-ticket'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('login tickets', () => {
  it('round-trips a login ticket with jti', () => {
    const jti = newLoginTicketJti()
    const sealed = sealLoginTicket(
      { userId: 'user_1', audience: 'company', exp: Date.now() + LOGIN_TICKET_TTL_MS, jti },
      SECRET,
    )
    const opened = openLoginTicket(sealed, SECRET)
    expect(opened?.userId).toBe('user_1')
    expect(opened?.audience).toBe('company')
    expect(opened?.jti).toBe(jti)
  })

  it('rejects expired tickets', () => {
    const sealed = sealLoginTicket(
      {
        userId: 'user_1',
        audience: 'staff',
        exp: Date.now() - 1000,
        jti: newLoginTicketJti(),
      },
      SECRET,
    )
    expect(openLoginTicket(sealed, SECRET)).toBeNull()
  })

  it('rejects tickets without jti', () => {
    const body = Buffer.from(
      JSON.stringify({
        userId: 'user_1',
        audience: 'company',
        exp: Date.now() + LOGIN_TICKET_TTL_MS,
      }),
      'utf8',
    ).toString('base64url')
    const sig = createHmac('sha256', SECRET).update(`login-ticket.v1.${body}`).digest('base64url')
    expect(openLoginTicket(`${body}.${sig}`, SECRET)).toBeNull()
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
