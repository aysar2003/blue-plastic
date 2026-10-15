import { createHmac, timingSafeEqual } from 'node:crypto'

/** Invite links stay valid for 14 days — long enough to share by hand. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

type InvitePayload = { membershipId: string; orgId: string; exp: number }

/** Signed invite token — the customer opens it to set their own password. */
export function sealPortalInvite(input: {
  membershipId: string
  orgId: string
  secret: string
  now?: number
}): string {
  const payload: InvitePayload = {
    membershipId: input.membershipId,
    orgId: input.orgId,
    exp: (input.now ?? Date.now()) + INVITE_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', input.secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Returns the membership the token invites, or null when forged / expired. */
export function openPortalInvite(
  token: string,
  secret: string,
  now = Date.now(),
): { membershipId: string; orgId: string } | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<InvitePayload>
    if (!parsed.membershipId || !parsed.orgId || typeof parsed.exp !== 'number') return null
    if (parsed.exp <= now) return null
    return { membershipId: parsed.membershipId, orgId: parsed.orgId }
  } catch {
    return null
  }
}
