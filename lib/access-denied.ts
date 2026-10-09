import { moduleFor, tabFor } from '@/components/layout/nav-items'

import { FORBIDDEN_DIGEST } from '@/lib/forbidden-digest'

export { FORBIDDEN_DIGEST }

export const ACCESS_DENIED_TITLE = 'Ma haysatid ogolaansho aad ku isticmaasho qaybtan'
export const ACCESS_DENIED_SUBTITLE = "You don't have permission to use this section"

const HINT_SO = 'Fadlan la xiriir milkiilaha ama maamulaha.'
const HINT_EN = 'Contact the owner or an admin.'

export type AccessDeniedCopy = {
  title: string
  subtitle: string
  hintSo: string
  hintEn: string
  section: string | null
}

/** Somali title, English subtitle. Names the section when we know which one it is. */
export function accessDeniedCopy(section?: string | null): AccessDeniedCopy {
  const name = section?.trim() || null
  if (!name) {
    return {
      title: ACCESS_DENIED_TITLE,
      subtitle: ACCESS_DENIED_SUBTITLE,
      hintSo: HINT_SO,
      hintEn: HINT_EN,
      section: null,
    }
  }
  return {
    title: `Ma haysatid ogolaansho aad ku isticmaasho qaybta ${name}`,
    subtitle: `You don't have permission to use ${name}`,
    hintSo: HINT_SO,
    hintEn: HINT_EN,
    section: name,
  }
}

/** One line for a form banner that stays after the warning toast closes. */
export function formatAccessDeniedMessage(section?: string | null): string {
  const copy = accessDeniedCopy(section)
  return `${copy.title}. ${copy.subtitle}. ${copy.hintSo} ${copy.hintEn}`
}

/** The books module or tab a path belongs to, when that name is easy to say. */
export function sectionLabel(pathname: string): string | null {
  const path = (pathname.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/'
  if (path === '/dashboard') return 'Dashboard'
  if (path === '/pos-receipt' || path.startsWith('/pos-receipt/')) return 'Receipt'
  if (path === '/pos' || path.startsWith('/pos/')) return posSection(path)

  const mod = moduleFor(path)
  if (!mod) return null
  const tab = tabFor(mod, path)
  if (tab && tab.href !== mod.href) return tab.label
  return mod.label
}

function posSection(path: string): string {
  if (path.startsWith('/pos/orders')) return 'Orders'
  if (path.startsWith('/pos/quotations')) return 'Quotations'
  if (path.startsWith('/pos/sessions')) return 'Sessions'
  if (path.startsWith('/pos/settings')) return 'Point of Sale settings'
  return 'Point of Sale'
}

export function isForbiddenError(error: { digest?: string } | null | undefined): boolean {
  const digest = error?.digest
  if (!digest) return false
  return digest === FORBIDDEN_DIGEST || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;403')
}

/**
 * Page renders use phase `render`. Server actions and route handlers use
 * phase `action`, and those must keep returning a 403 result instead of
 * replacing the page.
 */
export function isRenderableForbiddenStore(
  store: { phase?: string; pathname?: string } | null | undefined,
): boolean {
  if (!store || store.phase !== 'render') return false
  const pathname = store.pathname ?? ''
  if (!pathname.startsWith('/')) return false
  if (pathname === '/api' || pathname.startsWith('/api/')) return false
  return true
}

export function isServerActionRequest(headers: { get(name: string): string | null }): boolean {
  return Boolean(headers.get('next-action'))
}

export function isApiForbiddenRequest(url: string, status: number): boolean {
  if (status !== 403) return false
  let pathname = url
  try {
    pathname = new URL(url, 'http://local').pathname
  } catch {
    return false
  }
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return false
  return pathname === '/api' || pathname.startsWith('/api/')
}

/** Action results carry this code. The flight payload includes it as JSON text. */
export function actionBodyDeniesAccess(body: string): boolean {
  return body.includes('"code":"FORBIDDEN"') || body.includes('\\"code\\":\\"FORBIDDEN\\"')
}

/** Hide the technical permission toast once the warning is already on screen. */
export function shouldSuppressDenialToast(message: unknown, deniedAt: number, now = Date.now()): boolean {
  if (!deniedAt || now - deniedAt > 2000) return false
  if (typeof message !== 'string') return false
  return /permission/i.test(message) || message.includes('Ma haysatid')
}
