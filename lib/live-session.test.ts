import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const getOrgContext = vi.fn()
const afterSignInPath = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('@/auth', () => ({
  auth: (...args: unknown[]) => auth(...args),
}))

vi.mock('@/server/auth/context', () => ({
  getOrgContext: (...args: unknown[]) => getOrgContext(...args),
}))

vi.mock('@/lib/after-sign-in', () => ({
  afterSignInPath: (...args: unknown[]) => afterSignInPath(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}))

describe('resumeOrClearSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when signed out', async () => {
    auth.mockResolvedValue(null)
    const { resumeOrClearSession } = await import('./live-session')
    await resumeOrClearSession('/login/company')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('resumes into the app when the membership is still live', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } })
    getOrgContext.mockResolvedValue({ userId: 'u1' })
    afterSignInPath.mockResolvedValue('/dashboard')
    const { resumeOrClearSession } = await import('./live-session')
    await expect(resumeOrClearSession('/login/company')).rejects.toThrow('NEXT_REDIRECT:/dashboard')
  })

  it('leaves the login form up when the JWT is stale', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } })
    getOrgContext.mockResolvedValue(null)
    const { resumeOrClearSession } = await import('./live-session')
    await resumeOrClearSession('/login/company')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('skips work after an explicit signed-out flag', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } })
    const { resumeOrClearSession } = await import('./live-session')
    await resumeOrClearSession('/login/company', { signedOut: true })
    expect(getOrgContext).not.toHaveBeenCalled()
  })
})
