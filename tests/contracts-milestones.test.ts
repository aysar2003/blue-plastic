import { describe, expect, it } from 'vitest'

import { inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('sales contracts schema', () => {
  it('stores milestones on a contract', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const contract = await tx.salesContract.create({
        data: {
          orgId: fixture.ctx.orgId,
          number: 'SC-TEST-1',
          name: 'Frame',
          contractValue: '50000',
          status: 'ACTIVE',
          milestones: {
            create: [
              { orgId: fixture.ctx.orgId, lineNumber: 1, name: 'Deposit', percent: '20' },
              { orgId: fixture.ctx.orgId, lineNumber: 2, name: 'Final', percent: '80' },
            ],
          },
        },
        include: { milestones: true },
      })
      expect(contract.milestones).toHaveLength(2)
    })
  })
})