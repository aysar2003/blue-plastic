import { describe, expect, it } from 'vitest'

import { buildPosTipPayoutJournal } from '@/server/accounting/builders/pos'
import { Decimal } from '@/lib/money'
import { getPack } from '@/lib/packs/registry'

describe('lite close pass 1', () => {
  it('builds a tip payout journal that clears tip liability', () => {
    const draft = buildPosTipPayoutJournal({
      date: '2026-11-11',
      nightAuditId: 'audit_1',
      bankAccountId: 'bank_1',
      tipLiabilityAccountId: 'tip_1',
      amount: new Decimal('12.50'),
      businessDate: '2026-11-11',
    })
    expect(draft?.sourceType).toBe('POS_TIP_PAYOUT')
    expect(draft?.idempotencyKey).toBe('pos-tip-payout:audit_1')
    expect(draft?.lines).toHaveLength(2)
    expect(draft?.lines[0]?.accountId).toBe('tip_1')
    expect(draft?.lines[1]?.accountId).toBe('bank_1')
  })

  it('refuses zero tip payout drafts', () => {
    expect(
      buildPosTipPayoutJournal({
        date: '2026-11-11',
        nightAuditId: 'audit_1',
        bankAccountId: 'bank_1',
        tipLiabilityAccountId: 'tip_1',
        amount: 0,
        businessDate: '2026-11-11',
      }),
    ).toBeNull()
  })

  it('updates pack inScope for pass-1 gaps', () => {
    expect(getPack('restaurant')?.inScope).toContain('Night audit tip payout')
    expect(getPack('hotel')?.inScope).toContain('Nightly room post')
    expect(getPack('pharmacy')?.inScope).toContain('Expired lot disposal')
    expect(getPack('school')?.inScope).toContain('Term batch billing')
    expect(getPack('hospital_admin')?.inScope).toContain('Claim export stamp')
    expect(getPack('ngo')?.inScope).toContain('Fund BS by class')
    expect(getPack('professional_services')?.inScope).toContain('WIP write-up / write-down')
    expect(getPack('construction')?.inScope).toContain('Site store link')
    expect(getPack('manufacturing')?.inScope).toContain('Weekday capacity calendar')
    expect(getPack('distribution')?.inScope).toContain('Dock appointments')
    expect(getPack('retail')?.inScope).toContain('Named price lists & % promos')
  })
})
