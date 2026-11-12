import 'server-only'

import { env } from '@/lib/env'
import {
  LOGIN_TICKET_TTL_MS,
  newLoginTicketJti,
  openLoginTicket,
  sealLoginTicket,
  type TicketPayload,
} from '@/lib/login-ticket'
import { db } from '@/server/db'

/**
 * Persist a one-time ticket then seal it. Replay after consumeLoginTicket fails.
 */
export async function issueLoginTicket(input: {
  userId: string
  audience: TicketPayload['audience']
}): Promise<string> {
  const jti = newLoginTicketJti()
  const exp = Date.now() + LOGIN_TICKET_TTL_MS
  await db.loginTicket.create({
    data: {
      jti,
      userId: input.userId,
      audience: input.audience,
      expiresAt: new Date(exp),
    },
  })
  return sealLoginTicket(
    { userId: input.userId, audience: input.audience, exp, jti },
    env.AUTH_SECRET,
  )
}

/**
 * Verify signature + expiry, then mark `jti` consumed atomically.
 * Returns null when invalid, expired, or already used.
 */
export async function consumeLoginTicket(token: string): Promise<TicketPayload | null> {
  const payload = openLoginTicket(token, env.AUTH_SECRET)
  if (!payload) return null

  const result = await db.loginTicket.updateMany({
    where: {
      jti: payload.jti,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  })
  if (result.count !== 1) return null
  return payload
}
