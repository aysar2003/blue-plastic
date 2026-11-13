export type PosNetworkStatus = {
  online: boolean
  checkedAt: number
}

/** True when the browser flag is on and `/api/health` answers ok. */
export async function probePosOnline(timeoutMs = 1500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (typeof fetch === 'undefined') return false
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller?.signal,
    })
    if (!response.ok) return false
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null
    return body?.ok === true
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Subscribe to browser online/offline. Call `probe` yourself after online events
 * if you need server reachability, not only the browser flag.
 */
export function subscribeBrowserOnline(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const up = () => onChange(true)
  const down = () => onChange(false)
  window.addEventListener('online', up)
  window.addEventListener('offline', down)
  onChange(typeof navigator === 'undefined' ? true : navigator.onLine)
  return () => {
    window.removeEventListener('online', up)
    window.removeEventListener('offline', down)
  }
}
