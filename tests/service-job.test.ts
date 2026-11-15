import { describe, expect, it } from 'vitest'

import { inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('service jobs schema', () => {
  it('persists a draft job with lines', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Field Co' },
        select: { id: true },
      })
      const item = await tx.item.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'Labour',
          type: 'SERVICE',
          incomeAccountId: fixture.accounts['4000'],
        },
        select: { id: true },
      })
      const job = await tx.serviceJob.create({
        data: {
          orgId: fixture.ctx.orgId,
          number: 'SJ-TEST-1',
          date: new Date('2026-04-01'),
          customerId: customer.id,
          status: 'DRAFT',
          lines: {
            create: {
              orgId: fixture.ctx.orgId,
              lineNumber: 1,
              kind: 'LABOR',
              itemId: item.id,
              quantity: '1',
              unitPrice: '100',
            },
          },
        },
        include: { lines: true },
      })
      expect(job.lines).toHaveLength(1)
    })
  })
})