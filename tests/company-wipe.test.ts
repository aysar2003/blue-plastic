import { describe, expect, it } from 'vitest'

import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { wipeCompanyBooks } from '@/server/company-wipe'
import { db } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('company wipe', () => {
  it('deletes a company that has posted journals, reversals, and a chart tree', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const posted = await postJournal(tx, ctx, {
        date: '2026-02-01',
        memo: 'Owner puts in capital',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.bank], debit: '50000' },
          { accountId: accounts[CODE.capital], credit: '50000' },
        ],
      })

      await reverseJournal(tx, ctx, posted.id, { reason: 'wipe probe', date: '2026-02-02' })

      await tx.customer.create({
        data: { orgId: ctx.orgId, displayName: 'Wipe Probe Customer', isActive: true },
      })

      await wipeCompanyBooks(tx, ctx.orgId)
      await tx.organization.delete({ where: { id: ctx.orgId } })

      expect(await tx.organization.findUnique({ where: { id: ctx.orgId } })).toBeNull()
      expect(await tx.journal.count({ where: { orgId: ctx.orgId } })).toBe(0)
      expect(await tx.ledgerAccount.count({ where: { orgId: ctx.orgId } })).toBe(0)
    })
  })
})
