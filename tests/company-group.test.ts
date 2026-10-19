import { describe, expect, it } from 'vitest'

import {
  MAX_SUB_COMPANIES,
  applyGroupReportView,
  companyGroupKind,
  companyGroupLabel,
  groupUserCompanies,
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
    expect(companyGroupLabel('standalone')).toBe('Solo')
  })

  it('scopes reports to one, each, or combined', () => {
    const scope = {
      orgIds: ['main', 'sub'],
      rootOrgId: 'main',
      title: 'SAFA · group',
      companies: [
        { id: 'main', name: 'SAFA', parentOrgId: null, baseCurrency: 'USD' },
        { id: 'sub', name: 'AL FURAAT 3', parentOrgId: 'main', baseCurrency: 'USD' },
      ],
    }
    expect(applyGroupReportView(scope, { view: 'one', org: 'sub' })).toMatchObject({
      view: 'one',
      selectedOrgId: 'sub',
      orgIds: ['sub'],
      title: 'AL FURAAT 3',
    })
    expect(applyGroupReportView(scope, { view: 'each' }).view).toBe('each')
    expect(applyGroupReportView(scope, { view: 'combined' })).toMatchObject({
      view: 'combined',
      title: 'SAFA · combined',
      orgIds: ['main', 'sub'],
    })
  })

  it('groups a person’s companies under the main they belong to', () => {
    const grouped = groupUserCompanies([
      {
        role: 'OWNER',
        status: 'ACTIVE',
        organization: {
          id: 'main',
          name: 'AL FURAAT GROUP OF COMPANY',
          parentOrgId: null,
          parent: null,
        },
      },
      {
        role: 'OWNER',
        status: 'ACTIVE',
        organization: {
          id: 'sub',
          name: 'AL FURAAT HARDWARE',
          parentOrgId: 'main',
          parent: { id: 'main', name: 'AL FURAAT GROUP OF COMPANY' },
        },
      },
      {
        role: 'ADMIN',
        status: 'INVITED',
        organization: {
          id: 'golden',
          name: 'GOLDEN',
          parentOrgId: null,
          parent: null,
        },
      },
    ])
    expect(grouped).toEqual([
      {
        rootId: 'main',
        name: 'AL FURAAT GROUP OF COMPANY',
        companyCount: 2,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      {
        rootId: 'golden',
        name: 'GOLDEN',
        companyCount: 1,
        role: 'ADMIN',
        status: 'INVITED',
      },
    ])
  })
})
