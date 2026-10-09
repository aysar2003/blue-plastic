'use client'

import { useSyncExternalStore } from 'react'

const EVENT = 'bp-browser-store'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

/** Remember a value on this browser and tell same-tab readers. */
export function writeBrowserStore(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private mode or a full disk. The screen still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT))
}

/**
 * The stored string for `key`. The server and the first paint see `null`,
 * then the client snapshot takes over without a hydration mismatch.
 */
export function useBrowserStore(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null,
  )
}
