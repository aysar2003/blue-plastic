import { describe, expect, it } from 'vitest'

import { openPortalInvite, sealPortalInvite } from '@/lib/portal-invite-token'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('portal invite token', () => {
  it('seals and opens a valid invite', () => {
    const token = sealPortalInvite({
      membershipId: 'mem_1',
      orgId: 'org_1',
      secret: SECRET,
      now: 1_000_000,
    })
    expect(openPortalInvite(token, SECRET, 1_000_000)).toEqual({
      membershipId: 'mem_1',
      orgId: 'org_1',
    })
  })

  it('rejects a forged or expired token', () => {
    const token = sealPortalInvite({
      membershipId: 'mem_1',
      orgId: 'org_1',
      secret: SECRET,
      now: 1_000_000,
    })
    expect(openPortalInvite(token + 'x', SECRET, 1_000_000)).toBeNull()
    expect(openPortalInvite(token, 'other-secret-that-is-at-least-32-chars!!', 1_000_000)).toBeNull()
    const fortnight = 14 * 24 * 60 * 60 * 1000
    expect(openPortalInvite(token, SECRET, 1_000_000 + fortnight + 1)).toBeNull()
  })
})
