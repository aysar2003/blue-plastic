import { describe, expect, it } from 'vitest'

import { closeYear } from '@/server/accounting/close'
import { ensureFiscalYear } from '@/server/accounting/period'
import { postJournal } from '@/server/accounting/posting'
import { LIVE_FISCAL_YEARS } from '@/lib/year-archive'
import { balanceSheet } from '@/server/reports/statements'
import { type Tx } from '@/server/db'
import { archiveFiscalYearTx, restoreFiscalYearTx } from '@/server/services/year-archive.service'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function fiscalYearId(tx: Tx, orgId: string, year: number) {
  const row = await tx.fiscalYear.findFirstOrThrow({
    where: { orgId, year },
    select: { id: true },
  })
  return row.id
}

async function seedClosedYear(tx: Tx, fixture: Fixture, year: number) {
  const { ctx, accounts } = fixture
  await ensureFiscalYear(tx, ctx.orgId, ctx.organization.fiscalYearStartMonth, year)

  await postJournal(tx, ctx, {
    date: `${year}-03-15`,
    memo: `Trade ${year}`,
    sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.bank], debit: '5000' },
      { accountId: accounts[CODE.sales], credit: '5000' },
    ],
  })
  await postJournal(tx, ctx, {
    date: `${year}-06-01`,
    memo: `Expense ${year}`,
    sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.rent], debit: '1000' },
      { accountId: accounts[CODE.bank], credit: '1000' },
    ],
  })

  const yearId = await fiscalYearId(tx, ctx.orgId, year)
  await closeYear(tx, ctx, yearId)
  return yearId
}

suite('year archive', () => {
  it('archives an empty locked year outside the live window', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const { ctx } = fixture
      await ensureFiscalYear(tx, ctx.orgId, ctx.organization.fiscalYearStartMonth, 2018)
      const yearId = await fiscalYearId(tx, ctx.orgId, 2018)
      await closeYear(tx, ctx, yearId)
      for (let y = 2019; y <= 2026; y++) {
        await ensureFiscalYear(tx, ctx.orgId, ctx.organization.fiscalYearStartMonth, y)
      }

      const result = await archiveFiscalYearTx(tx, ctx, yearId)
      expect(result.year).toBe(2018)
      expect(result.checksum).toHaveLength(64)
      expect(result.bridgeJournalId).toBeNull()

      const fy = await tx.fiscalYear.findUniqueOrThrow({
        where: { id: yearId },
        select: { archivedAt: true, archiveBlobId: true },
      })
      expect(fy.archivedAt).not.toBeNull()
      expect(fy.archiveBlobId).toBeTruthy()
    })
  })

  it(`refuses to archive a year inside the ${LIVE_FISCAL_YEARS}-year live window`, async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      // 2026 is current (test clock / env); ensure + close it.
      const yearId = await seedClosedYear(tx, fixture, 2026)

      await expect(archiveFiscalYearTx(tx, fixture.ctx, yearId)).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
      })
    })
  })

  it('archives oldest eligible year, keeps BS balanced via bridge, and restores', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const { ctx } = fixture

      // Live window is current-4 .. current. Seed an old closed year + later years so
      // the bridge has a next year to land in.
      const oldYear = 2020
      const yearId = await seedClosedYear(tx, fixture, oldYear)
      for (let y = oldYear + 1; y <= 2026; y++) {
        await ensureFiscalYear(tx, ctx.orgId, ctx.organization.fiscalYearStartMonth, y)
      }

      const before = await balanceSheet(ctx.orgId, '2026-12-31', { client: tx })
      expect(before.balanced).toBe(true)

      const journalsBefore = await tx.journal.count({
        where: { orgId: ctx.orgId, period: { fiscalYearId: yearId } },
      })
      expect(journalsBefore).toBeGreaterThan(0)

      const archived = await archiveFiscalYearTx(tx, ctx, yearId)
      expect(archived.year).toBe(oldYear)
      expect(archived.checksum).toHaveLength(64)
      expect(archived.bridgeJournalId).toBeTruthy()

      const fy = await tx.fiscalYear.findUniqueOrThrow({
        where: { id: yearId },
        select: { archivedAt: true, archiveBlobId: true },
      })
      expect(fy.archivedAt).not.toBeNull()
      expect(fy.archiveBlobId).toBeTruthy()

      const journalsAfter = await tx.journal.count({
        where: { orgId: ctx.orgId, period: { fiscalYearId: yearId } },
      })
      expect(journalsAfter).toBe(0)

      const afterArchive = await balanceSheet(ctx.orgId, '2026-12-31', { client: tx })
      expect(afterArchive.balanced).toBe(true)
      expect(afterArchive.totalAssets.toString()).toBe(before.totalAssets.toString())
      expect(afterArchive.totalEquity.toString()).toBe(before.totalEquity.toString())

      const restored = await restoreFiscalYearTx(tx, ctx, yearId)
      expect(restored.year).toBe(oldYear)
      expect(restored.journalsRestored).toBe(journalsBefore)

      const journalsRestored = await tx.journal.count({
        where: { orgId: ctx.orgId, period: { fiscalYearId: yearId } },
      })
      expect(journalsRestored).toBe(journalsBefore)

      const afterRestore = await balanceSheet(ctx.orgId, '2026-12-31', { client: tx })
      expect(afterRestore.balanced).toBe(true)
      expect(afterRestore.totalAssets.toString()).toBe(before.totalAssets.toString())
    })
  })

  it('lists the next year to archive oldest-first', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedClosedYear(tx, fixture, 2019)
      await seedClosedYear(tx, fixture, 2020)
      for (let y = 2021; y <= 2026; y++) {
        await ensureFiscalYear(
          tx,
          fixture.ctx.orgId,
          fixture.ctx.organization.fiscalYearStartMonth,
          y,
        )
      }

      // listArchiveStatus uses db, not tx — call eligibility logic via archive attempt order.
      await archiveFiscalYearTx(
        tx,
        fixture.ctx,
        await fiscalYearId(tx, fixture.ctx.orgId, 2019),
      )

      await expect(
        archiveFiscalYearTx(tx, fixture.ctx, await fiscalYearId(tx, fixture.ctx.orgId, 2020)),
      ).resolves.toMatchObject({ year: 2020 })

      // Cannot restore 2019 while 2020 is still archived.
      await expect(
        restoreFiscalYearTx(tx, fixture.ctx, await fiscalYearId(tx, fixture.ctx.orgId, 2019)),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    })
  })
})
