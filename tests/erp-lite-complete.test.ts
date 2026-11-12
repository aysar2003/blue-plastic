import { describe, expect, it } from 'vitest'

import {
  canHireApplicant,
  canMoveApplicant,
  canRejectApplicant,
} from '@/lib/erp/applicant-pipeline'
import { canCancelAppointment, slotsOverlap } from '@/lib/erp/appointment-overlap'
import { explodeBom, leafNeeds, shortage } from '@/lib/erp/bom-explode'
import { capTable, ownershipAddsToHundred, totalShares } from '@/lib/erp/cap-table'
import { canMoveOpportunity, isOpenOpportunity } from '@/lib/erp/crm-pipeline'
import { extractMentions } from '@/lib/erp/discuss-mentions'
import { hedgeDocumented, hedgeEffective, markToMarket } from '@/lib/erp/fx-hedge'
import { withIntercompanyMemo, isIntercompanyMemo } from '@/lib/erp/intercompany-memo'
import { canBumpKitchen, nextKitchenStatus } from '@/lib/erp/kitchen-ticket'
import { canInstallApp, canUninstallApp } from '@/lib/erp/marketplace'
import { digitsPhone, notifyGatewayConfigured } from '@/lib/notify-gateway'
import { ERP_NON_GOALS, ERP_READY_LOOPS } from '@/lib/erp/readiness'
import { signCertificateReady, signatureDigest } from '@/lib/erp/sign-certificate'
import { canCompleteTraining } from '@/lib/erp/training'
import { binCodeValid, canStartPick } from '@/lib/erp/wms-pick'
import {
  canCancelSignRequest,
  canSignRequest,
  isSignRequestExpired,
  publicSignPath,
} from '@/lib/erp/sign-workflow'
import { aggregateSurvey, canSubmitSurvey, parseQuestions } from '@/lib/erp/survey-results'
import { Decimal, ZERO } from '@/lib/money'

describe('applicant pipeline', () => {
  it('only hires from offer and allows the screening path', () => {
    expect(canMoveApplicant('NEW', 'SCREENING')).toBe(true)
    expect(canMoveApplicant('SCREENING', 'INTERVIEW')).toBe(true)
    expect(canMoveApplicant('INTERVIEW', 'OFFER')).toBe(true)
    expect(canHireApplicant('NEW')).toBe(false)
    expect(canHireApplicant('OFFER')).toBe(true)
    expect(canRejectApplicant('INTERVIEW')).toBe(true)
    expect(canMoveApplicant('REJECTED', 'NEW')).toBe(true)
    expect(canMoveApplicant('HIRED', 'OFFER')).toBe(false)
  })
})

describe('appointments', () => {
  it('detects overlapping slots and only completes booked ones', () => {
    const a0 = new Date('2026-11-04T09:00:00Z')
    const a1 = new Date('2026-11-04T10:00:00Z')
    const b0 = new Date('2026-11-04T09:30:00Z')
    const b1 = new Date('2026-11-04T10:30:00Z')
    expect(slotsOverlap(a0, a1, b0, b1)).toBe(true)
    expect(slotsOverlap(a0, a1, a1, b1)).toBe(false)
    expect(canCancelAppointment('BOOKED')).toBe(true)
    expect(canCancelAppointment('CANCELLED')).toBe(false)
  })
})

describe('bill of materials explode', () => {
  it('rolls nested assemblies into leaf shortages', () => {
    const kit = {
      id: 'kit',
      name: 'Kit',
      quantity: new Decimal(1),
      children: [
        {
          id: 'pack',
          name: 'Pack',
          quantity: new Decimal(2),
          children: [
            { id: 'bag', name: 'Bag', quantity: new Decimal(3) },
            { id: 'tie', name: 'Tie', quantity: new Decimal(1) },
          ],
        },
        { id: 'label', name: 'Label', quantity: new Decimal(1) },
      ],
    }
    const exploded = explodeBom(kit, new Decimal(4))
    const leaves = leafNeeds(exploded)
    const bag = leaves.find((row) => row.id === 'bag')
    expect(bag?.quantity.toString()).toBe('24')
    expect(shortage(new Decimal(24), new Decimal(10)).toString()).toBe('14')
    expect(shortage(new Decimal(5), new Decimal(10)).equals(ZERO)).toBe(true)
  })
})

describe('cap table', () => {
  it('derives ownership from shares and checks 100%', () => {
    const table = capTable([
      { id: 'a', name: 'Amina', shares: new Decimal(60) },
      { id: 'b', name: 'Bilal', shares: new Decimal(40) },
    ])
    expect(totalShares(table).toString()).toBe('100')
    expect(table[0]?.ownershipPercent.toString()).toBe('60')
    expect(ownershipAddsToHundred(table)).toBe(true)
  })
})

describe('CRM pipeline', () => {
  it('moves lead to won only through the stages', () => {
    expect(canMoveOpportunity('LEAD', 'QUALIFIED')).toBe(true)
    expect(canMoveOpportunity('LEAD', 'WON')).toBe(false)
    expect(canMoveOpportunity('PROPOSAL', 'WON')).toBe(true)
    expect(isOpenOpportunity('WON')).toBe(false)
    expect(canMoveOpportunity('LOST', 'LEAD')).toBe(true)
  })
})

describe('sign workflow', () => {
  it('allows signing sent requests and builds a public path', () => {
    expect(canSignRequest('SENT')).toBe(true)
    expect(canSignRequest('SIGNED')).toBe(false)
    expect(canCancelSignRequest('DRAFT')).toBe(true)
    expect(publicSignPath('abc')).toBe('/sign-request/abc')
  })

  it('expires public links from expiresAt or createdAt + TTL', () => {
    const now = new Date('2026-01-20T00:00:00Z')
    expect(
      isSignRequestExpired({
        expiresAt: new Date('2026-01-19T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        now,
      }),
    ).toBe(true)
    expect(
      isSignRequestExpired({
        expiresAt: new Date('2026-01-21T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        now,
      }),
    ).toBe(false)
    expect(
      isSignRequestExpired({
        expiresAt: null,
        createdAt: new Date('2025-12-01T00:00:00Z'),
        now,
      }),
    ).toBe(true)
  })
})

describe('surveys', () => {
  it('parses questions and averages scores', () => {
    const questions = parseQuestions([
      { id: 'q1', label: 'Score us', type: 'score' },
      { id: 'q2', label: 'Comment', type: 'text' },
    ])
    const tally = aggregateSurvey(questions, [
      { answers: { q1: '8', q2: 'Good' } },
      { answers: { q1: '6' } },
    ])
    expect(tally[0]?.averageScore).toBe(7)
    expect(tally[1]?.responseCount).toBe(1)
    expect(canSubmitSurvey('OPEN')).toBe(true)
    expect(canSubmitSurvey('CLOSED')).toBe(false)
  })
})

describe('intercompany memo', () => {
  it('prefixes [IC] once', () => {
    expect(withIntercompanyMemo('rent', true)).toBe('[IC] rent')
    expect(withIntercompanyMemo('[IC] rent', true)).toBe('[IC] rent')
    expect(withIntercompanyMemo('rent', false)).toBe('rent')
    expect(isIntercompanyMemo('[IC] rent')).toBe(true)
  })
})

describe('notify gateway', () => {
  it('requires a full phone and is off without env', () => {
    expect(digitsPhone('+252 61 730 5588')).toBe('252617305588')
    expect(digitsPhone('123')).toBeNull()
    expect(notifyGatewayConfigured()).toBe(false)
  })
})

describe('legal layers', () => {
  it('documents IFRS 9 hedges and marks 80–125% effective', () => {
    expect(
      hedgeDocumented({
        risk: 'EUR receivables',
        hedgedItem: 'Open AR EUR',
        instrument: 'EUR forward',
        kind: 'CASH_FLOW',
      }),
    ).toBe(true)
    expect(hedgeEffective(100, 110)).toBe(true)
    expect(hedgeEffective(100, 200)).toBe(false)
    expect(markToMarket('1000', '1', '1.1')).toBe('100.0000')
  })

  it('bumps kitchen tickets and forbids robot bins', () => {
    expect(nextKitchenStatus('OPEN')).toBe('FIRED')
    expect(canBumpKitchen('READY', 'DONE')).toBe(true)
    expect(binCodeValid('A-01')).toBe(true)
    expect(binCodeValid('??')).toBe(false)
    expect(canStartPick('OPEN')).toBe(true)
  })

  it('installs only granted first-party apps and hashes a sign certificate', () => {
    expect(canInstallApp(true, false)).toBe(true)
    expect(canInstallApp(false, false)).toBe(false)
    expect(canUninstallApp(true, 1)).toBe(false)
    expect(extractMentions('hi @Amina and @amina')).toEqual(['amina'])
    expect(canCompleteTraining('ENROLLED')).toBe(true)
    expect(signCertificateReady('SIGNED', 'Amina')).toBe(true)
    expect(
      signatureDigest({
        orgId: 'o1',
        requestId: 'r1',
        signatureData: 'Amina',
        signedAt: '2026-11-04T00:00:00.000Z',
      }),
    ).toHaveLength(64)
  })
})

describe('ERP ready loops', () => {
  it('covers sell-collect-buy-stock-books-crm-people-collab-marketplace-institutions', () => {
    expect(ERP_READY_LOOPS.map((loop) => loop.id)).toEqual([
      'sell',
      'collect',
      'buy',
      'stock',
      'books',
      'crm',
      'people',
      'collab',
      'marketplace',
      'institutions',
    ])
    expect(ERP_READY_LOOPS.every((loop) => loop.ready)).toBe(true)
    expect(ERP_NON_GOALS.length).toBeGreaterThanOrEqual(4)
  })
})
