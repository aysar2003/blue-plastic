import { createHmac, timingSafeEqual } from 'node:crypto'

type TicketPayload = {
  userId: string
  /** Audience door that already passed the password check. */
  audience: 'staff' | 'company' | 'portal'
  exp: number
}

/**
 * One-time-ish signed ticket issued only after password (+ optional 2FA) succeeds.
 * Authorize() accepts this instead of a raw password so 2FA cannot be bypassed.
 */
export function sealLoginTicket(payload: TicketPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(`login-ticket.v1.${body}`).digest('base64url')
  return `${body}.${sig}`
}

export function openLoginTicket(token: string, secret: string): TicketPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null

  const expected = createHmac('sha256', secret).update(`login-ticket.v1.${body}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TicketPayload
    if (!parsed?.userId || !parsed.audience || typeof parsed.exp !== 'number') return null
    if (parsed.exp < Date.now()) return null
    if (!['staff', 'company', 'portal'].includes(parsed.audience)) return null
    return parsed
  } catch {
    return null
  }
}

export const LOGIN_TICKET_TTL_MS = 5 * 60 * 1000

/** Cookie holding a pending 2FA challenge after password OK. */
export type PreAuthPayload = {
  userId: string
  challengeId: string
  audience: 'staff' | 'company' | 'portal'
  email: string
  exp: number
}

export function sealPreAuth(payload: PreAuthPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(`preauth.v1.${body}`).digest('base64url')
  return `${body}.${sig}`
}

export function openPreAuth(token: string, secret: string): PreAuthPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null

  const expected = createHmac('sha256', secret).update(`preauth.v1.${body}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PreAuthPayload
    if (!parsed?.userId || !parsed.challengeId || !parsed.audience || !parsed.email) return null
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export const PREAUTH_COOKIE = 'som_preauth'
export const PREAUTH_TTL_MS = 10 * 60 * 1000
