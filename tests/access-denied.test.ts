import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/settings/users' }))

import { AccessDenied } from '@/components/system/access-denied'
import {
  ACCESS_DENIED_SUBTITLE,
  ACCESS_DENIED_TITLE,
  accessDeniedCopy,
  actionBodyDeniesAccess,
  formatAccessDeniedMessage,
  isApiForbiddenRequest,
  isForbiddenError,
  isRenderableForbiddenStore,
  sectionLabel,
  shouldSuppressDenialToast,
} from '@/lib/access-denied'
import { FORBIDDEN_DIGEST } from '@/lib/forbidden-digest'
import { forbidden } from '@/server/errors'

describe('access denied copy', () => {
  it('uses the Somali line with an English subtitle when the section is unknown', () => {
    const copy = accessDeniedCopy(null)
    expect(copy.title).toBe(ACCESS_DENIED_TITLE)
    expect(copy.subtitle).toBe(ACCESS_DENIED_SUBTITLE)
    expect(copy.hintSo).toMatch(/milkiilaha ama maamulaha/)
    expect(copy.hintEn).toMatch(/owner or an admin/)
  })

  it('names the section in both languages', () => {
    const copy = accessDeniedCopy('Business overview')
    expect(copy.title).toBe('Ma haysatid ogolaansho aad ku isticmaasho qaybta Business overview')
    expect(copy.subtitle).toBe("You don't have permission to use Business overview")
    expect(formatAccessDeniedMessage('Business overview')).toContain(copy.title)
    expect(formatAccessDeniedMessage('Business overview')).toContain(copy.subtitle)
  })
})

describe('section names', () => {
  it('reads the tab or module from the path', () => {
    expect(sectionLabel('/settings/users')).toBe('Users')
    expect(sectionLabel('/reports/profit-loss')).toBe('Profit and Loss')
    expect(sectionLabel('/reports/business-overview?period=this-month')).toBe('Business overview')
    expect(sectionLabel('/customers')).toBe('Customers')
    expect(sectionLabel('/sales')).toBe('Sales')
    expect(sectionLabel('/dashboard')).toBe('Dashboard')
    expect(sectionLabel('/pos')).toBe('Point of Sale')
    expect(sectionLabel('/pos/settings')).toBe('Point of Sale settings')
    expect(sectionLabel('/pos/registers/abc')).toBe('Point of Sale')
    expect(sectionLabel('/pos-receipt/doc')).toBe('Receipt')
    expect(sectionLabel('/nowhere')).toBeNull()
  })
})

describe('forbidden page versus action', () => {
  it('interrupts only a real page render', () => {
    expect(isRenderableForbiddenStore({ phase: 'render', pathname: '/reports' })).toBe(true)
    expect(isRenderableForbiddenStore({ phase: 'action', pathname: '/reports' })).toBe(false)
    expect(isRenderableForbiddenStore({ phase: 'render', pathname: '/api/backup' })).toBe(false)
    expect(isRenderableForbiddenStore({ phase: 'render', pathname: '' })).toBe(false)
    expect(isRenderableForbiddenStore(null)).toBe(false)
  })

  it('keeps a permission error as data outside a page render', () => {
    const error = forbidden('This action requires the "report:read" permission.')
    expect(error.code).toBe('FORBIDDEN')
    expect(error.status).toBe(403)
    expect(error.digest).toBe(FORBIDDEN_DIGEST)
    expect(isForbiddenError(error)).toBe(true)
    expect(isForbiddenError({ digest: 'NEXT_HTTP_ERROR_FALLBACK;403' })).toBe(true)
    expect(isForbiddenError({ digest: 'abc' })).toBe(false)
  })
})

describe('forbidden action notices', () => {
  it('spots a forbidden server action body and an API 403', () => {
    expect(actionBodyDeniesAccess('1:{"ok":false,"error":{"code":"FORBIDDEN","message":"no"}}')).toBe(true)
    expect(actionBodyDeniesAccess('{"status":"error","code":"VALIDATION"}')).toBe(false)
    expect(isApiForbiddenRequest('/api/backup', 403)).toBe(true)
    expect(isApiForbiddenRequest('https://books.example/api/reports/profit-loss', 403)).toBe(true)
    expect(isApiForbiddenRequest('/api/auth/session', 403)).toBe(false)
    expect(isApiForbiddenRequest('/reports', 403)).toBe(false)
    expect(isApiForbiddenRequest('/api/search?q=a', 200)).toBe(false)
  })

  it('swallows the technical permission toast just after the warning', () => {
    const now = 1_000
    expect(shouldSuppressDenialToast('This action requires the "invoice:void" permission.', now - 100, now)).toBe(
      true,
    )
    expect(shouldSuppressDenialToast('Ma haysatid ogolaansho aad ku isticmaasho qaybtan.', now - 100, now)).toBe(true)
    expect(shouldSuppressDenialToast('The owner cannot be removed.', now - 100, now)).toBe(false)
    expect(shouldSuppressDenialToast('This action requires permission.', now - 5_000, now)).toBe(false)
  })
})

describe('access denied screen', () => {
  it('shows the Somali message, the English subtitle, and a way back to the dashboard', () => {
    const html = renderToStaticMarkup(createElement(AccessDenied))
    expect(html).toContain('Ma haysatid ogolaansho aad ku isticmaasho qaybta Users')
    expect(html).toContain("You don&#x27;t have permission to use Users")
    expect(html).toContain('Fadlan la xiriir milkiilaha ama maamulaha.')
    expect(html).toContain('Contact the owner or an admin.')
    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('Back to dashboard')
    expect(html).toContain('data-access-denied')
  })

  it('uses an explicit section name when the page already knows it', () => {
    const html = renderToStaticMarkup(createElement(AccessDenied, { section: 'Business overview' }))
    expect(html).toContain('qaybta Business overview')
    expect(html).toContain("You don&#x27;t have permission to use Business overview")
  })
})
