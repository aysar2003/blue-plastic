import { createHmac, timingSafeEqual } from 'node:crypto'

const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000

type UnlockPayload = { orgId: string; registerId: string; exp: number }

/** Signed token proving this browser entered the PIN for one register. */
export function sealRegisterUnlock(input: {
  orgId: string
  registerId: string
  secret: string
  now?: number
}): string {
  const payload: UnlockPayload = {
    orgId: input.orgId,
    registerId: input.registerId,
    exp: (input.now ?? Date.now()) + UNLOCK_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', input.secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Returns the register the token unlocks, or null when it is missing, forged, or expired. */
export function openRegisterUnlock(
  token: string,
  secret: string,
  now = Date.now(),
): { orgId: string; registerId: string } | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<UnlockPayload>
    if (!parsed.orgId || !parsed.registerId || typeof parsed.exp !== 'number') return null
    if (parsed.exp <= now) return null
    return { orgId: parsed.orgId, registerId: parsed.registerId }
  } catch {
    return null
  }
}