import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { canMoveOpportunity } from '@/lib/erp/crm-pipeline'
import { ERP_CAPABILITIES, capabilityById } from '@/lib/erp/capabilities'
import { portalQuoteResponseSchema } from '@/lib/validation/portal'
import { respondToProposalSchema } from '@/lib/validation/sales'

const root = process.cwd()

describe('depth pass — CRM / portal / MRP / API', () => {
  it('Won is a valid forward move from Proposal', () => {
    expect(canMoveOpportunity('PROPOSAL', 'WON')).toBe(true)
  })

  it('validates portal quote accept/decline payloads', () => {
    expect(portalQuoteResponseSchema.safeParse({ id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', decision: 'accept' }).success).toBe(
      true,
    )
    expect(portalQuoteResponseSchema.safeParse({ id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', decision: 'decline' }).success).toBe(
      true,
    )
    expect(portalQuoteResponseSchema.safeParse({ id: '', decision: 'accept' }).success).toBe(false)
    expect(portalQuoteResponseSchema.safeParse({ id: 'x', decision: 'maybe' }).success).toBe(false)
  })

  it('validates staff proposal response payloads', () => {
    expect(
      respondToProposalSchema.safeParse({ id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', response: 'ACCEPTED' }).success,
    ).toBe(true)
    expect(
      respondToProposalSchema.safeParse({ id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', response: 'DECLINED' }).success,
    ).toBe(true)
  })

  it('exposes deepen machine capabilities', () => {
    for (const id of ['customers.list', 'serviceJobs.list', 'crm.board', 'mrp.materialsPlan'] as const) {
      expect(capabilityById(id)?.id).toBe(id)
    }
    expect(ERP_CAPABILITIES.length).toBeGreaterThanOrEqual(9)
  })

  it('ships portal response UI and deepen route adapters', () => {
    const required = [
      'app/(portal)/portal/quotes/actions.ts',
      'components/portal/portal-quote-response.tsx',
      'app/api/v1/customers/route.ts',
      'app/api/v1/service-jobs/route.ts',
      'app/api/v1/crm/board/route.ts',
      'app/api/v1/mrp/plan/route.ts',
      'docs/phases/phase-depth-crm-portal-mrp-api.md',
    ]
    for (const relative of required) {
      expect(existsSync(join(root, relative)), relative).toBe(true)
    }
  })
})
