import { describe, expect, it } from 'vitest'

import {
  MAX_SUB_COMPANIES,
  companyGroupKind,
  companyGroupLabel,
} from '@/lib/company-group'

describe('company group', () => {
  it('allows two sub-companies under a main', () => {
    expect(MAX_SUB_COMPANIES).toBe(2)
  })

  it('labels main, sub, and standalone', () => {
    expect(companyGroupKind({ parentOrgId: null, childCount: 0 })).toBe('standalone')
    expect(companyGroupKind({ parentOrgId: null, childCount: 1 })).toBe('main')
    expect(companyGroupKind({ parentOrgId: 'main-1', childCount: 0 })).toBe('sub')
    expect(companyGroupLabel('main')).toBe('Main')
    expect(companyGroupLabel('sub')).toBe('Sub')
    expect(companyGroupLabel('standalone')).toBeNull()
  })
})
