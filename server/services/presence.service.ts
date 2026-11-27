import 'server-only'

import { PRESENCE_WRITE_THROTTLE_MS } from '@/lib/presence'
import { db } from '@/server/db'

/**
 * Touch lastSeenAt for the signed-in user. Throttled so a chatty tab
 * does not write every few seconds.
 */
export async function touchPresence(userId: string) {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { lastSeenAt: true },
  })
  if (!existing) return { ok: false as const, skipped: true as const }

  const now = Date.now()
  const previous = existing.lastSeenAt?.getTime() ?? 0
  if (now - previous < PRESENCE_WRITE_THROTTLE_MS) {
    return { ok: true as const, skipped: true as const }
  }

  await db.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date(now) },
  })
  return { ok: true as const, skipped: false as const }
}
