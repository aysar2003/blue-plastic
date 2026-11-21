import { describe, expect, it } from 'vitest'

import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
  cancelRestoresVanStock,
  promisedWindowLabel,
} from '@/lib/erp/service-job'

describe('service job status guards', () => {
  it('schedule from draft only', () => {
    expect(canScheduleServiceJob('DRAFT')).toBe(true)
    expect(canScheduleServiceJob('SCHEDULED')).toBe(false)
  })

  it('complete from scheduled only', () => {
    expect(canCompleteServiceJob('SCHEDULED')).toBe(true)
    expect(canCompleteServiceJob('DRAFT')).toBe(false)
  })

  it('cancel draft, scheduled, or done', () => {
    expect(canCancelServiceJob('DRAFT')).toBe(true)
    expect(canCancelServiceJob('SCHEDULED')).toBe(true)
    expect(canCancelServiceJob('DONE')).toBe(true)
    expect(canCancelServiceJob('CANCELLED')).toBe(false)
  })

  it('restores van stock only when a completed job has an invoice', () => {
    expect(cancelRestoresVanStock('DONE', 'inv_1')).toBe(true)
    expect(cancelRestoresVanStock('DONE', null)).toBe(false)
    expect(cancelRestoresVanStock('SCHEDULED', 'inv_1')).toBe(false)
  })

  it('formats a promised window', () => {
    expect(promisedWindowLabel('2026-11-21T08:00:00.000Z', '2026-11-21T10:00:00.000Z')).toContain('2026-11-21')
    expect(promisedWindowLabel(null, null)).toBeNull()
  })
})