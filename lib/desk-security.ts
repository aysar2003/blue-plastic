/**
 * Company desk security: idle lock + absolute session logout.
 * Shared by Settings → Organisation and the IdleLock watchdog.
 */

export const DEFAULT_IDLE_LOCK_SECONDS = 15 * 60
export const DEFAULT_SESSION_MAX_HOURS = 10

/** Hard ceiling for NextAuth JWT — org setting cannot exceed this. */
export const SESSION_MAX_HOURS_CEILING = 24

export const IDLE_LOCK_PRESETS: { seconds: number; label: string }[] = [
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 5 * 60, label: '5 minutes' },
  { seconds: 10 * 60, label: '10 minutes' },
  { seconds: 15 * 60, label: '15 minutes' },
  { seconds: 30 * 60, label: '30 minutes' },
]

export const SESSION_LOGOUT_PRESETS: { hours: number; label: string }[] = [
  { hours: 1, label: '1 hour' },
  { hours: 4, label: '4 hours' },
  { hours: 8, label: '8 hours' },
  { hours: 10, label: '10 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
]

export function clampIdleLockSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_IDLE_LOCK_SECONDS
  return Math.min(24 * 60 * 60, Math.max(30, Math.round(value)))
}

export function clampSessionMaxHours(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SESSION_MAX_HOURS
  return Math.min(SESSION_MAX_HOURS_CEILING, Math.max(1, Math.round(value)))
}

export function formatIdleLockLabel(seconds: number): string {
  const s = clampIdleLockSeconds(seconds)
  const preset = IDLE_LOCK_PRESETS.find((row) => row.seconds === s)
  if (preset) return preset.label
  if (s < 60) return `${s} seconds`
  if (s % 60 === 0) {
    const m = s / 60
    return m === 1 ? '1 minute' : `${m} minutes`
  }
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
