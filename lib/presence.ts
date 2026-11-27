/**
 * Desk presence — a signed-in browser that heartbeats while the tab is open.
 * Online = lastSeenAt within PRESENCE_ONLINE_MS (not the same as membership ACTIVE).
 */

export const PRESENCE_ONLINE_MS = 2 * 60 * 1000
/** Client ping interval — keep under the online window. */
export const PRESENCE_HEARTBEAT_MS = 45_000
/** Skip a DB write when the previous heartbeat was this recent. */
export const PRESENCE_WRITE_THROTTLE_MS = 30_000

export function isUserOnline(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastSeenAt) return false
  const at = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt
  if (Number.isNaN(at.getTime())) return false
  return now.getTime() - at.getTime() <= PRESENCE_ONLINE_MS
}

export function presenceLabel(online: boolean): 'Online' | 'Offline' {
  return online ? 'Online' : 'Offline'
}

/** Short relative hint for lists (“Online now”, “3m ago”, “—”). */
export function presenceActivityLabel(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (!lastSeenAt) return '—'
  const at = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt
  if (Number.isNaN(at.getTime())) return '—'
  const delta = Math.max(0, now.getTime() - at.getTime())
  if (delta <= PRESENCE_ONLINE_MS) return 'Online now'
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function presenceDotClass(online: boolean): string {
  if (online) {
    return 'bg-emerald-400 shadow-[0_0_0_3px_rgb(52_211_153/0.28)] animate-pulse'
  }
  return 'bg-zinc-400/75'
}
