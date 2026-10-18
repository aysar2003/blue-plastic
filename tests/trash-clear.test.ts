import { afterAll, describe, expect, it } from 'vitest'

import { isHiddenFromTrash } from '@/lib/trash-log'
import { deleteJournals, restoreJournals } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import { db, type Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function postRent(tx: Tx, fixture: Fixture, amount: string) {
  return postJournal(tx, fixture.ctx, {
    date: '2026-03-01',
    memo: 'Rent',
    sourceType: 'MANUAL',
    lines: [
      { accountId: fixture.accounts[CODE.rent], debit: amount },
      { accountId: fixture.accounts[CODE.bank], credit: amount },
    ],
  })
}

suite('trash restore and clear', () => {
  it('restores a deleted manual journal into balances again', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '120')

      await deleteJournals(tx, fixture.ctx, [journal.id], 'mistake')
      expect(
        (
          await tx.journal.findUnique({
            where: { id: journal.id },
            select: { status: true },
          })
        )?.status,
      ).toBe('DELETED')

      await restoreJournals(tx, fixture.ctx, [journal.id])

      const after = await tx.journal.findUnique({
        where: { id: journal.id },
        select: { status: true, deletedAt: true, deleteReason: true },
      })
      expect(after?.status).toBe('POSTED')
      expect(after?.deletedAt).toBeNull()
      expect(after?.deleteReason).toBeNull()
    })
  })

  it('marks a trash DELETE row cleared so it leaves the active trash filter', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '55')
      await deleteJournals(tx, fixture.ctx, [journal.id], 'clear me')

      const log = await tx.auditLog.findFirst({
        where: {
          orgId: fixture.ctx.orgId,
          action: 'DELETE',
          entity: 'Journal',
          entityId: journal.id,
        },
        select: { id: true, after: true },
      })
      expect(log).not.toBeNull()

      const previous =
        log!.after && typeof log!.after === 'object' && !Array.isArray(log!.after)
          ? (log!.after as Record<string, unknown>)
          : {}

      await tx.auditLog.update({
        where: { id: log!.id },
        data: {
          after: {
            ...previous,
            cleared: true,
            clearedAt: new Date().toISOString(),
            clearedById: fixture.ctx.userId,
          },
        },
      })

      const deletes = await tx.auditLog.findMany({
        where: { orgId: fixture.ctx.orgId, action: 'DELETE' },
        select: { id: true, after: true },
      })
      const active = deletes.filter((row) => !isHiddenFromTrash(row.after))

      expect(active.map((row) => row.id)).not.toContain(log!.id)

      // Clearing trash does not resurrect the journal.
      const journalAfter = await tx.journal.findUnique({
        where: { id: journal.id },
        select: { status: true },
      })
      expect(journalAfter?.status).toBe('DELETED')
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})
