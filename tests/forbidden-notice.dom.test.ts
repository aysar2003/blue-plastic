// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'

import { installForbiddenFetchNotice } from '@/lib/forbidden-notice'

const warn = vi.mocked(toast.warning)
const errorToast = vi.mocked(toast.error)

describe('forbidden action warning', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
    warn.mockClear()
    errorToast.mockClear()
  })

  it('shows a warning for an API 403 and still lets the caller read the body', async () => {
    window.fetch = vi.fn(async () => new Response('denied', { status: 403 })) as typeof fetch
    restore = installForbiddenFetchNotice()

    const response = await fetch('/api/backup')
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('denied')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('Ma haysatid ogolaansho')
  })

  it('shows a warning for a forbidden server action and hides the technical error toast', async () => {
    window.fetch = vi.fn(
      async () =>
        new Response('1:{"ok":false,"error":{"code":"FORBIDDEN","message":"This action requires the \\"invoice:void\\" permission."}}', {
          status: 200,
        }),
    ) as typeof fetch
    restore = installForbiddenFetchNotice()

    await fetch('/sales/invoices', { method: 'POST', headers: { 'next-action': 'abc' } })
    expect(warn).toHaveBeenCalledTimes(1)
    toast.error('This action requires the "invoice:void" permission.')
    expect(errorToast).not.toHaveBeenCalled()
  })

  it('does not warn when a page navigation is forbidden', async () => {
    window.fetch = vi.fn(async () => new Response('page', { status: 403 })) as typeof fetch
    restore = installForbiddenFetchNotice()

    await fetch('/reports', { headers: { rsc: '1' } })
    expect(warn).not.toHaveBeenCalled()
  })
})
