import { toast } from 'sonner'

import {
  accessDeniedCopy,
  actionBodyDeniesAccess,
  isApiForbiddenRequest,
  isServerActionRequest,
  sectionLabel,
  shouldSuppressDenialToast,
} from '@/lib/access-denied'

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function readHeader(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
  const fromInit = new Headers(init?.headers ?? undefined).get(name)
  if (fromInit) return fromInit
  if (typeof Request !== 'undefined' && input instanceof Request) return input.headers.get(name)
  return null
}

function showDenial() {
  const copy = accessDeniedCopy(
    typeof window === 'undefined' ? null : sectionLabel(window.location.pathname),
  )
  toast.warning(copy.title, {
    id: 'access-denied',
    description: `${copy.subtitle}. ${copy.hintSo} ${copy.hintEn}`,
  })
}

/**
 * Server actions return 200 with the error in the body. API routes return 403.
 * Page navigations are left alone so the access-denied screen is the only notice.
 */
export function installForbiddenFetchNotice(): () => void {
  if (typeof window === 'undefined') return () => {}

  const originalFetch = window.fetch.bind(window)
  const originalError = toast.error.bind(toast)
  let deniedAt = 0

  const show = () => {
    deniedAt = Date.now()
    showDenial()
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init)
    try {
      const headers = { get: (name: string) => readHeader(input, init, name) }
      if (isServerActionRequest(headers)) {
        const body = await response.clone().text()
        if (response.status === 403 || actionBodyDeniesAccess(body)) show()
      } else if (isApiForbiddenRequest(readUrl(input), response.status)) {
        show()
      }
    } catch {
      // Reading a copy must not break the caller that still needs the body.
    }
    return response
  }

  toast.error = ((message, data) => {
    if (shouldSuppressDenialToast(message, deniedAt)) return 'access-denied'
    return originalError(message, data)
  }) as typeof toast.error

  return () => {
    window.fetch = originalFetch
    toast.error = originalError
  }
}
