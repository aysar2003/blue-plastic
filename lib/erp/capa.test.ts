import { describe, expect, it } from 'vitest'

import { nextCapaStatus } from '@/lib/erp/capa'

describe('capa status transitions', () => {
  it('allows open → in progress → closed', () => {
    expect(nextCapaStatus('OPEN', 'IN_PROGRESS').ok).toBe(true)
    expect(nextCapaStatus('IN_PROGRESS', 'CLOSED').ok).toBe(true)
  })

  it('blocks closed → in progress', () => {
    expect(nextCapaStatus('CLOSED', 'IN_PROGRESS').ok).toBe(false)
  })
})