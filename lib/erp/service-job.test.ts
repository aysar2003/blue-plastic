import { describe, expect, it } from 'vitest'

import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
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

  it('cancel draft or scheduled', () => {
    expect(canCancelServiceJob('DRAFT')).toBe(true)
    expect(canCancelServiceJob('SCHEDULED')).toBe(true)
    expect(canCancelServiceJob('DONE')).toBe(false)
  })
})