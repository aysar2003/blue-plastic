import 'server-only'

import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

import { Prisma } from '@prisma/client'

import { fiscalYearOf, toCalendarDate, today, toDate } from '@/lib/date'
import { LIVE_FISCAL_YEARS, type YearArchivePackage } from '@/lib/year-archive'
import { type DraftLine } from '@/server/accounting/posting'
import { ensureFiscalYear } from '@/server/accounting/period'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { allowCompanyWipe } from '@/server/company-wipe'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import { nextDocumentNumber } from '@/server/sequences'

export type ArchiveStatus = {
  liveWindowYears: number
  currentFiscalYear: number
  liveFromYear: number
  nextToArchive: { id: string; year: number } | null
  archived: {
    id: string
    year: number
    archivedAt: Date
    archiveChecksum: string | null
    canRestore: boolean
  }[]
  liveYears: { id: string; year: number; status: string; archivedAt: Date | null }[]
}

type PackedJournal = {
  id: string
  journalNumber: string
  date: string
  periodId: string
  memo: string | null
  sourceType: string
  sourceId: string | null
  status: string
  isAdjusting: boolean
  isClosingEntry: boolean
  autoReverse: boolean
  reversalOfId: string | null
  reversalReason: string | null
  currencyCode: string
  exchangeRate: string
  idempotencyKey: string | null
  postedAt: string
  createdById: string | null
  deletedAt: string | null
  deletedById: string | null
  deleteReason: string | null
}

type PackedLine = {
  id: string
  journalId: string
  lineNumber: number
  accountId: string
  debit: string
  credit: string
  description: string | null
  journalDate: string
  customerId: string | null
  vendorId: string | null
  trackingCategoryId: string | null
  foreignDebit: string | null
  foreignCredit: string | null
}

function checksumOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function cutoffYear(currentFiscalYear: number): number {
  return currentFiscalYear - LIVE_FISCAL_YEARS
}

export async function listArchiveStatus(ctx: OrgContext): Promise<ArchiveStatus> {
  const currentFiscalYear = fiscalYearOf(
    today(ctx.organization.timeZone),
    ctx.organization.fiscalYearStartMonth,
  )
  const liveFromYear = currentFiscalYear - LIVE_FISCAL_YEARS + 1

  const years = await db.fiscalYear.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { year: 'asc' },
    select: {
      id: true,
      year: true,
      status: true,
      archivedAt: true,
      archiveChecksum: true,
    },
  })

  const archivedRows = years.filter((y) => y.archivedAt)
  const newestArchivedYear = archivedRows.reduce(
    (max, row) => Math.max(max, row.year),
    Number.NEGATIVE_INFINITY,
  )

  const nextToArchive =
    years.find(
      (y) =>
        !y.archivedAt &&
        y.status === 'LOCKED' &&
        y.year <= cutoffYear(currentFiscalYear),
    ) ?? null

  return {
    liveWindowYears: LIVE_FISCAL_YEARS,
    currentFiscalYear,
    liveFromYear,
    nextToArchive: nextToArchive
      ? { id: nextToArchive.id, year: nextToArchive.year }
      : null,
    archived: archivedRows
      .map((y) => ({
        id: y.id,
        year: y.year,
        archivedAt: y.archivedAt!,
        archiveChecksum: y.archiveChecksum,
        canRestore: y.year === newestArchivedYear,
      }))
      .sort((a, b) => b.year - a.year),
    liveYears: years
      .filter((y) => !y.archivedAt)
      .map((y) => ({
        id: y.id,
        year: y.year,
        status: y.status,
        archivedAt: y.archivedAt,
      })),
  }
}

export async function archiveFiscalYear(ctx: OrgContext, fiscalYearId: string) {
  const meta = await requestMeta()
  return db.$transaction(
    async (tx) => {
      const result = await archiveFiscalYearTx(tx, ctx, fiscalYearId)
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'FiscalYear',
          entityId: fiscalYearId,
          action: 'ARCHIVE',
          after: {
            year: result.year,
            checksum: result.checksum,
            bridgeJournalId: result.bridgeJournalId,
          },
        },
        meta,
      )
      return result
    },
    { maxWait: 20_000, timeout: 180_000 },
  )
}

export async function restoreFiscalYear(ctx: OrgContext, fiscalYearId: string) {
  const meta = await requestMeta()
  return db.$transaction(
    async (tx) => {
      const result = await restoreFiscalYearTx(tx, ctx, fiscalYearId)
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'FiscalYear',
          entityId: fiscalYearId,
          action: 'RESTORE',
          after: { year: result.year, journalsRestored: result.journalsRestored },
        },
        meta,
      )
      return result
    },
    { maxWait: 20_000, timeout: 180_000 },
  )
}

/** Core archive — callable inside test transactions. */
export async function archiveFiscalYearTx(
  tx: Tx,
  ctx: OrgContext,
  fiscalYearId: string,
): Promise<{ year: number; checksum: string; bridgeJournalId: string | null }> {
  const currentFiscalYear = fiscalYearOf(
    today(ctx.organization.timeZone),
    ctx.organization.fiscalYearStartMonth,
  )
  const maxArchivable = cutoffYear(currentFiscalYear)

  const fiscalYear = await tx.fiscalYear.findFirst({
    where: { id: fiscalYearId, orgId: ctx.orgId },
    select: {
      id: true,
      year: true,
      startDate: true,
      endDate: true,
      status: true,
      closingJournalId: true,
      archivedAt: true,
    },
  })
  if (!fiscalYear) throw notFound('Fiscal year')
  if (fiscalYear.archivedAt) throw precondition(`Fiscal year ${fiscalYear.year} is already archived.`)
  if (fiscalYear.status !== 'LOCKED') {
    throw precondition(
      `Fiscal year ${fiscalYear.year} must be closed (locked) before it can be archived.`,
    )
  }
  if (fiscalYear.year > maxArchivable) {
    throw precondition(
      `Keep the newest ${LIVE_FISCAL_YEARS} fiscal years live. ` +
        `FY ${fiscalYear.year} is still inside the live window (archive only through FY ${maxArchivable}).`,
    )
  }

  const olderLive = await tx.fiscalYear.findFirst({
    where: {
      orgId: ctx.orgId,
      year: { lt: fiscalYear.year },
      archivedAt: null,
    },
    orderBy: { year: 'asc' },
    select: { year: true },
  })
  if (olderLive) {
    throw precondition(
      `Archive fiscal year ${olderLive.year} first. Years archive oldest-first so the opening bridge stays correct.`,
    )
  }

  const periods = await tx.accountingPeriod.findMany({
    where: { orgId: ctx.orgId, fiscalYearId },
    orderBy: { periodNumber: 'asc' },
  })
  const periodIds = periods.map((p) => p.id)

  const journals =
    periodIds.length === 0
      ? []
      : await tx.journal.findMany({
          where: { orgId: ctx.orgId, periodId: { in: periodIds } },
          orderBy: [{ date: 'asc' }, { journalNumber: 'asc' }],
        })
  const journalIds = journals.map((j) => j.id)

  const journalLines =
    journalIds.length === 0
      ? []
      : await tx.journalLine.findMany({
          where: { orgId: ctx.orgId, journalId: { in: journalIds } },
          orderBy: [{ journalId: 'asc' }, { lineNumber: 'asc' }],
        })

  const packedJournals: PackedJournal[] = journals.map((j) => ({
    id: j.id,
    journalNumber: j.journalNumber,
    date: toCalendarDate(j.date),
    periodId: j.periodId,
    memo: j.memo,
    sourceType: j.sourceType,
    sourceId: j.sourceId,
    status: j.status,
    isAdjusting: j.isAdjusting,
    isClosingEntry: j.isClosingEntry,
    autoReverse: j.autoReverse,
    reversalOfId: j.reversalOfId,
    reversalReason: j.reversalReason,
    currencyCode: j.currencyCode,
    exchangeRate: j.exchangeRate.toFixed(9),
    idempotencyKey: j.idempotencyKey,
    postedAt: j.postedAt.toISOString(),
    createdById: j.createdById,
    deletedAt: j.deletedAt?.toISOString() ?? null,
    deletedById: j.deletedById,
    deleteReason: j.deleteReason,
  }))

  const packedLines: PackedLine[] = journalLines.map((l) => ({
    id: l.id,
    journalId: l.journalId,
    lineNumber: l.lineNumber,
    accountId: l.accountId,
    debit: l.debit.toFixed(4),
    credit: l.credit.toFixed(4),
    description: l.description,
    journalDate: toCalendarDate(l.journalDate),
    customerId: l.customerId,
    vendorId: l.vendorId,
    trackingCategoryId: l.trackingCategoryId,
    foreignDebit: l.foreignDebit?.toFixed(4) ?? null,
    foreignCredit: l.foreignCredit?.toFixed(4) ?? null,
  }))

  const pkg: YearArchivePackage = {
    version: 1,
    kind: 'fiscal-year-archive',
    takenAt: new Date().toISOString(),
    orgId: ctx.orgId,
    fiscalYear: {
      id: fiscalYear.id,
      year: fiscalYear.year,
      startDate: toCalendarDate(fiscalYear.startDate),
      endDate: toCalendarDate(fiscalYear.endDate),
      status: fiscalYear.status,
      closingJournalId: fiscalYear.closingJournalId,
    },
    periods: periods.map((p) => ({
      id: p.id,
      periodNumber: p.periodNumber,
      startDate: toCalendarDate(p.startDate),
      endDate: toCalendarDate(p.endDate),
      status: p.status,
    })),
    journals: packedJournals,
    journalLines: packedLines,
  }

  const payload = gzipSync(Buffer.from(JSON.stringify(pkg), 'utf8'))
  const checksum = checksumOf(payload)

  const blob = await tx.yearArchiveBlob.create({
    data: {
      orgId: ctx.orgId,
      year: fiscalYear.year,
      checksum,
      payload,
    },
    select: { id: true },
  })

  // Bridge carries BS balances forward into the next live year before we purge.
  const bridgeJournalId = await postArchiveBridge(tx, ctx, fiscalYear)

  await allowCompanyWipe(tx)

  if (fiscalYear.closingJournalId) {
    await tx.fiscalYear.update({
      where: { id: fiscalYear.id },
      data: { closingJournalId: null },
    })
  }

  // Prior archived years may point at a bridge that lived in this year's period 0.
  if (journalIds.length > 0) {
    await tx.fiscalYear.updateMany({
      where: { orgId: ctx.orgId, archiveBridgeJournalId: { in: journalIds } },
      data: { archiveBridgeJournalId: null },
    })
    await hardDeleteYearJournals(tx, ctx.orgId, journalIds)
  }

  await tx.fiscalYear.update({
    where: { id: fiscalYear.id },
    data: {
      archivedAt: new Date(),
      archiveChecksum: checksum,
      archiveBlobId: blob.id,
      archiveBridgeJournalId: bridgeJournalId,
      // Closing journal row was purged; id lives in the archive package until restore.
      closingJournalId: null,
    },
  })

  return { year: fiscalYear.year, checksum, bridgeJournalId }
}

/** Core restore — newest archived year only (LIFO). */
export async function restoreFiscalYearTx(
  tx: Tx,
  ctx: OrgContext,
  fiscalYearId: string,
): Promise<{ year: number; journalsRestored: number }> {
  const fiscalYear = await tx.fiscalYear.findFirst({
    where: { id: fiscalYearId, orgId: ctx.orgId },
    select: {
      id: true,
      year: true,
      archivedAt: true,
      archiveChecksum: true,
      archiveBlobId: true,
      archiveBridgeJournalId: true,
      closingJournalId: true,
    },
  })
  if (!fiscalYear) throw notFound('Fiscal year')
  if (!fiscalYear.archivedAt || !fiscalYear.archiveBlobId) {
    throw precondition(`Fiscal year ${fiscalYear.year} is not archived.`)
  }

  const newerArchived = await tx.fiscalYear.findFirst({
    where: {
      orgId: ctx.orgId,
      archivedAt: { not: null },
      year: { gt: fiscalYear.year },
    },
    orderBy: { year: 'asc' },
    select: { year: true },
  })
  if (newerArchived) {
    throw precondition(
      `Restore fiscal year ${newerArchived.year} first. Years restore newest-archived-first.`,
    )
  }

  const blob = await tx.yearArchiveBlob.findFirst({
    where: { id: fiscalYear.archiveBlobId, orgId: ctx.orgId },
  })
  if (!blob) throw precondition('The archive package for this year is missing.')

  const checksum = checksumOf(Buffer.from(blob.payload))
  if (fiscalYear.archiveChecksum && checksum !== fiscalYear.archiveChecksum) {
    throw precondition('Archive checksum does not match. Refusing to restore a corrupt package.')
  }
  if (checksum !== blob.checksum) {
    throw precondition('Archive blob checksum does not match. Refusing to restore.')
  }

  let pkg: YearArchivePackage
  try {
    pkg = JSON.parse(gunzipSync(Buffer.from(blob.payload)).toString('utf8')) as YearArchivePackage
  } catch {
    throw validation('Could not read the archive package.')
  }
  if (pkg.kind !== 'fiscal-year-archive' || pkg.orgId !== ctx.orgId) {
    throw validation('This archive package is not for this company.')
  }

  await allowCompanyWipe(tx)

  if (fiscalYear.archiveBridgeJournalId) {
    await hardDeleteYearJournals(tx, ctx.orgId, [fiscalYear.archiveBridgeJournalId])
  }

  const journals = pkg.journals as PackedJournal[]
  const lines = pkg.journalLines as PackedLine[]

  // Period-open trigger refuses inserts into LOCKED months; unlock for the reload.
  await tx.accountingPeriod.updateMany({
    where: { orgId: ctx.orgId, fiscalYearId: fiscalYear.id },
    data: { status: 'OPEN', closedAt: null, closedById: null },
  })

  try {
    for (const j of journals) {
      await tx.journal.create({
        data: {
          id: j.id,
          orgId: ctx.orgId,
          journalNumber: j.journalNumber,
          date: toDate(j.date),
          periodId: j.periodId,
          memo: j.memo,
          sourceType: j.sourceType as never,
          sourceId: j.sourceId,
          status: j.status as never,
          isAdjusting: j.isAdjusting,
          isClosingEntry: j.isClosingEntry,
          autoReverse: j.autoReverse,
          reversalOfId: null,
          reversalReason: j.reversalReason,
          currencyCode: j.currencyCode,
          exchangeRate: new Prisma.Decimal(j.exchangeRate),
          idempotencyKey: j.idempotencyKey,
          postedAt: new Date(j.postedAt),
          createdById: j.createdById,
          deletedAt: j.deletedAt ? new Date(j.deletedAt) : null,
          deletedById: j.deletedById,
          deleteReason: j.deleteReason,
        },
      })
    }

    for (const j of journals) {
      if (j.reversalOfId) {
        await tx.journal.update({
          where: { id: j.id },
          data: { reversalOfId: j.reversalOfId },
        })
      }
    }

    if (lines.length > 0) {
      await tx.journalLine.createMany({
        data: lines.map((l) => ({
          id: l.id,
          journalId: l.journalId,
          orgId: ctx.orgId,
          lineNumber: l.lineNumber,
          accountId: l.accountId,
          debit: new Prisma.Decimal(l.debit),
          credit: new Prisma.Decimal(l.credit),
          description: l.description,
          journalDate: toDate(l.journalDate),
          customerId: l.customerId,
          vendorId: l.vendorId,
          trackingCategoryId: l.trackingCategoryId,
          foreignDebit: l.foreignDebit ? new Prisma.Decimal(l.foreignDebit) : null,
          foreignCredit: l.foreignCredit ? new Prisma.Decimal(l.foreignCredit) : null,
        })),
      })
    }
  } finally {
    await tx.accountingPeriod.updateMany({
      where: { orgId: ctx.orgId, fiscalYearId: fiscalYear.id },
      data: { status: 'LOCKED', closedAt: new Date(), closedById: ctx.userId },
    })
  }

  const closingJournalId = pkg.fiscalYear.closingJournalId
  await tx.fiscalYear.update({
    where: { id: fiscalYear.id },
    data: {
      archivedAt: null,
      archiveChecksum: null,
      archiveBlobId: null,
      archiveBridgeJournalId: null,
      closingJournalId,
      status: 'LOCKED',
    },
  })

  await tx.yearArchiveBlob.delete({ where: { id: blob.id } })

  return { year: fiscalYear.year, journalsRestored: journals.length }
}

async function postArchiveBridge(
  tx: Tx,
  ctx: OrgContext,
  fiscalYear: { id: string; year: number; endDate: Date },
): Promise<string | null> {
  const asOf = toCalendarDate(fiscalYear.endDate)
  const balances = await tx.$queryRaw<
    { accountId: string; balance: Prisma.Decimal }[]
  >`
    SELECT a.id AS "accountId",
           COALESCE(SUM(l.debit - l.credit), 0) AS balance
      FROM ledger_accounts a
      LEFT JOIN journal_lines l
        ON l."accountId" = a.id
       AND l."orgId" = a."orgId"
       AND l."journalDate" <= ${toDate(asOf)}
     WHERE a."orgId" = ${ctx.orgId}
       AND a.type IN ('ASSET', 'LIABILITY', 'EQUITY')
       AND a."isActive" = true
       AND NOT EXISTS (
         SELECT 1 FROM ledger_accounts c
          WHERE c."parentId" = a.id AND c."orgId" = a."orgId"
       )
     GROUP BY a.id
    HAVING COALESCE(SUM(l.debit - l.credit), 0) <> 0
  `

  if (balances.length === 0) return null

  const lines: DraftLine[] = []
  for (const row of balances) {
    const bal = new Prisma.Decimal(row.balance.toString())
    if (bal.isZero()) continue
    if (bal.isPositive()) {
      lines.push({ accountId: row.accountId, debit: bal.toFixed(4) })
    } else {
      lines.push({ accountId: row.accountId, credit: bal.negated().toFixed(4) })
    }
  }
  if (lines.length < 2) return null

  await ensureFiscalYear(
    tx,
    ctx.orgId,
    ctx.organization.fiscalYearStartMonth,
    fiscalYear.year + 1,
  )
  const nextYear = await tx.fiscalYear.findFirstOrThrow({
    where: { orgId: ctx.orgId, year: fiscalYear.year + 1 },
    select: { id: true },
  })
  const opening = await tx.accountingPeriod.findFirstOrThrow({
    where: { fiscalYearId: nextYear.id, periodNumber: 0 },
    select: { id: true, startDate: true, status: true },
  })

  // Period 0 is the calendar day before the next year starts — the same date as
  // the prior year's last trading day. postJournal would resolve that date to the
  // locked December period, so pin the bridge to period 0 explicitly.
  const priorStatus = opening.status
  if (priorStatus !== 'OPEN') {
    await tx.accountingPeriod.update({
      where: { id: opening.id },
      data: { status: 'OPEN', closedAt: null, closedById: null },
    })
  }

  try {
    const existing = await tx.journal.findUnique({
      where: {
        orgId_idempotencyKey: {
          orgId: ctx.orgId,
          idempotencyKey: `year-archive-bridge:${fiscalYear.id}`,
        },
      },
      select: { id: true },
    })
    if (existing) return existing.id

    const journalNumber = await nextDocumentNumber(tx, ctx.orgId, 'JOURNAL')
    const bridgeDate = opening.startDate
    const journal = await tx.journal.create({
      data: {
        orgId: ctx.orgId,
        journalNumber,
        date: bridgeDate,
        periodId: opening.id,
        memo: `Opening bridge after archiving FY ${fiscalYear.year}`,
        sourceType: 'OPENING_BALANCE',
        sourceId: fiscalYear.id,
        status: 'POSTED',
        currencyCode: ctx.organization.baseCurrency,
        exchangeRate: 1,
        idempotencyKey: `year-archive-bridge:${fiscalYear.id}`,
        createdById: ctx.userId,
        lines: {
          create: lines.map((line, index) => ({
            orgId: ctx.orgId,
            lineNumber: index + 1,
            accountId: line.accountId,
            debit: new Prisma.Decimal(String(line.debit ?? 0)).toFixed(4),
            credit: new Prisma.Decimal(String(line.credit ?? 0)).toFixed(4),
            description: line.description ?? null,
            journalDate: bridgeDate,
          })),
        },
      },
      select: { id: true },
    })
    return journal.id
  } finally {
    if (priorStatus !== 'OPEN') {
      await tx.accountingPeriod.update({
        where: { id: opening.id },
        data: {
          status: priorStatus,
          closedAt: priorStatus === 'LOCKED' || priorStatus === 'CLOSED' ? new Date() : null,
          closedById:
            priorStatus === 'LOCKED' || priorStatus === 'CLOSED' ? ctx.userId : null,
        },
      })
    }
  }
}

async function hardDeleteYearJournals(tx: Tx, orgId: string, journalIds: string[]): Promise<void> {
  if (journalIds.length === 0) return

  const related = await tx.journal.findMany({
    where: {
      orgId,
      OR: [{ id: { in: journalIds } }, { reversalOfId: { in: journalIds } }],
    },
    select: { id: true },
  })
  const ids = related.map((r) => r.id)
  if (ids.length === 0) return

  await tx.salesDocument.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.customerPayment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.purchaseDocument.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.billPayment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.bankTransfer.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.deposit.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.inventoryAdjustment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.assemblyBuild.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.storeTransfer.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.posCashMovement.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.posSession.updateMany({
    where: { orgId, closingJournalId: { in: ids } },
    data: { closingJournalId: null },
  })
  await tx.inventoryTransaction.deleteMany({
    where: { orgId, journalId: { in: ids } },
  })

  const lines = await tx.journalLine.findMany({
    where: { orgId, journalId: { in: ids } },
    select: { id: true },
  })
  const lineIds = lines.map((l) => l.id)
  if (lineIds.length > 0) {
    await tx.reconciliationEntry.deleteMany({
      where: { orgId, journalLineId: { in: lineIds } },
    })
  }

  await tx.journal.updateMany({
    where: { orgId, id: { in: ids } },
    data: { reversalOfId: null },
  })
  await tx.journal.deleteMany({ where: { orgId, id: { in: ids } } })
}
