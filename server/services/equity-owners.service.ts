import 'server-only'

import type { Workbook as ExcelWorkbook } from 'exceljs'

import { parseCsv, parseTable, pick, type CsvRow } from '@/lib/csv'
import { today } from '@/lib/date'
import { OWNERS_EQUITY_HEADERS, type OwnersEquityImportLine } from '@/lib/equity-owners-sheet'
import { Decimal, ZERO, parseMoneyInput, toMoneyString } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { postJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'
import { precondition, validation } from '@/server/errors'
import { workbookRecords } from '@/server/services/workbook'

export type OwnersEquityRow = {
  accountId: string
  code: string
  name: string
  subtype: string
  /** Credit − debit (positive = credit balance, normal for equity). */
  balance: string
}

export type OwnersEquitySnapshot = {
  retainedEarnings: {
    accountId: string
    code: string
    name: string
    /** Credit − debit. Positive = profit sitting in RE ready to distribute. */
    balance: string
  }
  owners: OwnersEquityRow[]
}

/** Owner's capital accounts plus current Retained Earnings balance. */
export async function ownersEquitySnapshot(ctx: OrgContext): Promise<OwnersEquitySnapshot> {
  const retained = await db.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, systemKey: 'RETAINED_EARNINGS', isActive: true },
    select: { id: true, code: true, name: true },
  })
  if (!retained) {
    throw precondition(
      'There is no Retained Earnings account. Install or restore the chart of accounts first.',
    )
  }

  const owners = await db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      type: 'EQUITY',
      subtype: 'OWNERS_EQUITY',
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    select: { id: true, code: true, name: true, subtype: true },
  })

  const ids = [retained.id, ...owners.map((row) => row.id)]
  const balances = await equityBalances(ctx.orgId, ids)

  return {
    retainedEarnings: {
      accountId: retained.id,
      code: retained.code,
      name: retained.name,
      balance: toMoneyString(balances.get(retained.id) ?? ZERO),
    },
    owners: owners.map((row) => ({
      accountId: row.id,
      code: row.code,
      name: row.name,
      subtype: row.subtype,
      balance: toMoneyString(balances.get(row.id) ?? ZERO),
    })),
  }
}

/** Credit − debit per account (equity normal balance). */
async function equityBalances(orgId: string, accountIds: string[]): Promise<Map<string, Decimal>> {
  const map = new Map<string, Decimal>(accountIds.map((id) => [id, ZERO]))
  if (accountIds.length === 0) return map

  const rows = await db.journalLine.groupBy({
    by: ['accountId'],
    where: {
      orgId,
      accountId: { in: accountIds },
      journal: { orgId, status: { notIn: ['DRAFT', 'DELETED'] } },
    },
    _sum: { debit: true, credit: true },
  })
  for (const row of rows) {
    const credit = new Decimal(row._sum.credit ?? 0)
    const debit = new Decimal(row._sum.debit ?? 0)
    map.set(row.accountId, credit.minus(debit))
  }
  return map
}

/** Excel: fill Amount to allocate (and optional Share %), then import. */
export async function buildOwnersEquityWorkbook(ctx: OrgContext): Promise<Uint8Array> {
  const snap = await ownersEquitySnapshot(ctx)
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('Owners equity')
  const guide = workbook.addWorksheet('How to fill')

  const header = sheet.getRow(1)
  OWNERS_EQUITY_HEADERS.forEach((title, index) => {
    const cell = header.getCell(index + 1)
    cell.value = title
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F6C' } }
  })
  header.height = 22

  snap.owners.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2)
    excelRow.getCell(1).value = row.accountId
    excelRow.getCell(2).value = row.code
    excelRow.getCell(3).value = row.name
    excelRow.getCell(4).value = "Owner's equity"
    excelRow.getCell(5).value = Number(row.balance)
    excelRow.getCell(5).numFmt = '#,##0.00'
    excelRow.getCell(6).value = ''
    excelRow.getCell(7).value = ''
    excelRow.getCell(7).numFmt = '#,##0.00'
  })

  sheet.getColumn(1).width = 26
  sheet.getColumn(1).hidden = true
  sheet.getColumn(2).width = 14
  sheet.getColumn(3).width = 36
  sheet.getColumn(4).width = 16
  sheet.getColumn(5).width = 14
  sheet.getColumn(6).width = 12
  sheet.getColumn(7).width = 18
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: OWNERS_EQUITY_HEADERS.length },
  }

  guide.getCell(1, 1).value = 'How to distribute owners equity'
  guide.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF0B4F6C' } }
  guide.mergeCells(1, 1, 1, 3)
  guide.getCell(3, 1).value = `Retained earnings available now: ${snap.retainedEarnings.balance} (${snap.retainedEarnings.code} ${snap.retainedEarnings.name})`
  guide.getCell(3, 1).font = { bold: true }
  guide.mergeCells(3, 1, 3, 3)
  guide.getCell(5, 1).value = [
    '1. Close the fiscal year on Periods first — that zeros Profit & Loss and moves net income into Retained Earnings.',
    '2. Export this Owners equity list.',
    '3. Add more Owner\'s equity accounts on Chart of accounts if you need more partners (Detail type: Owner\'s equity).',
    '4. Fill Amount to allocate for each owner (Share % is optional note only — import reads Amount).',
    '5. Total of Amount to allocate must not exceed Retained earnings available.',
    '6. Import the saved file on Periods → Owners equity. SOM ERP posts: Debit Retained Earnings, Credit each owner.',
    '7. Do not rename column headings. Leave Amount blank to skip a row.',
  ].join('\n')
  guide.getCell(5, 1).alignment = { wrapText: true }
  guide.mergeCells(5, 1, 5, 3)
  guide.getRow(5).height = 150
  guide.getColumn(1).width = 90

  const raw = await workbook.xlsx.writeBuffer()
  return raw instanceof Uint8Array ? new Uint8Array(raw) : new Uint8Array(raw as ArrayBuffer)
}

export async function readOwnersEquityFile(file: {
  csv?: string
  workbook?: string
}): Promise<CsvRow[]> {
  if (file.workbook) return parseTable(await workbookRecords(file.workbook)).rows
  if (file.csv) return parseCsv(file.csv).rows
  return []
}

export function parseOwnersEquityRows(rows: CsvRow[]): {
  lines: OwnersEquityImportLine[]
  issues: { row: number; message: string }[]
} {
  const lines: OwnersEquityImportLine[] = []
  const issues: { row: number; message: string }[] = []

  rows.forEach((row, index) => {
    const excelRow = index + 2
    const accountId = (pick(row, 'Account ID', 'AccountId', 'Id') ?? '').trim()
    const code = (pick(row, 'Account number', 'Number', 'Code') ?? '').trim()
    const name = (pick(row, 'Account name', 'Name') ?? '').trim()
    const amountRaw = pick(row, 'Amount to allocate', 'Amount', 'Allocate')
    if (!amountRaw || String(amountRaw).trim() === '') return

    const amount = parseMoneyInput(String(amountRaw))
    if (!amount) {
      issues.push({ row: excelRow, message: 'Amount to allocate is not a number.' })
      return
    }
    if (amount.lte(0)) {
      issues.push({ row: excelRow, message: 'Amount to allocate must be greater than zero.' })
      return
    }
    if (!accountId && !code) {
      issues.push({ row: excelRow, message: 'Missing Account ID or Account number.' })
      return
    }

    lines.push({
      accountId,
      code,
      name,
      amount: toMoneyString(amount),
    })
  })

  return { lines, issues }
}

/**
 * Post allocation: Debit Retained Earnings, Credit each owner capital account.
 * Amounts must sum to no more than the credit balance in Retained Earnings.
 */
export async function importOwnersAllocation(
  ctx: OrgContext,
  file: { csv?: string; workbook?: string },
): Promise<{ journalNumber: string; total: string; lineCount: number }> {
  const rows = await readOwnersEquityFile(file)
  const { lines, issues } = parseOwnersEquityRows(rows)
  if (issues.length > 0 && lines.length === 0) {
    throw validation(issues[0]?.message ?? 'Could not read the owners file.')
  }
  if (lines.length === 0) {
    throw validation('Fill Amount to allocate on at least one owner row, then import again.')
  }

  const snap = await ownersEquitySnapshot(ctx)
  const reBalance = new Decimal(snap.retainedEarnings.balance)
  if (reBalance.lte(0)) {
    throw precondition(
      'Retained Earnings has no credit balance to distribute. Close the fiscal year first (or check the balance sheet).',
    )
  }

  const byId = new Map(snap.owners.map((row) => [row.accountId, row]))
  const byCode = new Map(snap.owners.map((row) => [row.code.toLowerCase(), row]))

  const resolved: { accountId: string; name: string; amount: Decimal }[] = []
  for (const line of lines) {
    const owner =
      (line.accountId ? byId.get(line.accountId) : undefined) ??
      (line.code ? byCode.get(line.code.toLowerCase()) : undefined)
    if (!owner) {
      throw validation(
        `Unknown owner account${line.code ? ` ${line.code}` : ''}${line.name ? ` (${line.name})` : ''}. Export a fresh list and keep Account ID.`,
      )
    }
    resolved.push({
      accountId: owner.accountId,
      name: owner.name,
      amount: new Decimal(line.amount),
    })
  }

  const total = resolved.reduce((sum, line) => sum.plus(line.amount), ZERO)
  if (total.gt(reBalance)) {
    throw validation(
      `Amounts total ${toMoneyString(total)} but Retained Earnings only has ${toMoneyString(reBalance)} available.`,
    )
  }

  const date = today(ctx.organization.timeZone)
  const journal = await db.$transaction((tx) =>
    postJournal(tx, ctx, {
      date,
      memo: 'Distribute retained earnings to owners equity',
      sourceType: 'MANUAL',
      isAdjusting: true,
      lines: [
        {
          accountId: snap.retainedEarnings.accountId,
          debit: total,
          credit: 0,
          description: 'Profit distributed to owners',
        },
        ...resolved.map((line) => ({
          accountId: line.accountId,
          debit: 0,
          credit: line.amount,
          description: `Share to ${line.name}`,
        })),
      ],
    }),
  )

  return {
    journalNumber: journal.journalNumber,
    total: toMoneyString(total),
    lineCount: resolved.length,
  }
}
