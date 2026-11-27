import { EQUITY_MOVEMENT_HEADERS, SHAREHOLDER_REGISTER_HEADERS } from '@/lib/erp/export-headers'
import { Decimal, ZERO } from '@/lib/money'

export type EquityEventKindKey = 'CONTRIBUTION' | 'DRAW' | 'DIVIDEND' | 'PATRONAGE'

/** GL subtype the event must post to so the owner's equity statement stays in step. */
export function equityEventStatementSubtype(
  kind: EquityEventKindKey,
): 'OWNERS_EQUITY' | 'DRAWINGS' | 'RETAINED_EARNINGS' {
  if (kind === 'CONTRIBUTION' || kind === 'PATRONAGE') return 'OWNERS_EQUITY'
  if (kind === 'DRAW') return 'DRAWINGS'
  return 'RETAINED_EARNINGS'
}

export function equityEventCreditsEquity(kind: EquityEventKindKey): boolean {
  return kind === 'CONTRIBUTION' || kind === 'PATRONAGE'
}

export type ShareholderRegisterRow = {
  name: string
  shares: string
  ownershipPercent: string
  capitalAccount?: string | null
}

export function shareholderRegisterTableRows(rows: ShareholderRegisterRow[]): string[][] {
  return rows.map((row) => [row.name, row.shares, row.ownershipPercent, row.capitalAccount ?? ''])
}

export function shareholderRegisterCsv(rows: ShareholderRegisterRow[]): string {
  const header = SHAREHOLDER_REGISTER_HEADERS.join(',')
  const body = shareholderRegisterTableRows(rows).map(
    (cells) =>
      `${csvEscape(cells[0]!)},${cells[1]},${cells[2]},${csvEscape(cells[3] ?? '')}`,
  )
  return [header, ...body].join('\n')
}

export type EquityMovementRow = {
  date: string
  kind: string
  shareholder: string
  amount: string
  memo: string
  equityAccount: string
}

export function equityMovementTableRows(rows: EquityMovementRow[]): string[][] {
  return rows.map((row) => [
    row.date,
    row.kind,
    row.shareholder,
    row.amount,
    row.memo,
    row.equityAccount,
  ])
}

export function equityMovementCsv(rows: EquityMovementRow[]): string {
  const header = EQUITY_MOVEMENT_HEADERS.join(',')
  const body = equityMovementTableRows(rows).map(
    (cells) =>
      `${cells[0]},${csvEscape(cells[1]!)},${csvEscape(cells[2]!)},${cells[3]},${csvEscape(cells[4]!)},${csvEscape(cells[5]!)}`,
  )
  return [header, ...body].join('\n')
}

export function equityMovementTotals(rows: EquityMovementRow[]): {
  contributions: string
  draws: string
  dividends: string
  net: string
} {
  let contributions = ZERO
  let draws = ZERO
  let dividends = ZERO
  for (const row of rows) {
    const amount = new Decimal(row.amount || 0)
    if (row.kind === 'CONTRIBUTION') contributions = contributions.plus(amount)
    else if (row.kind === 'DRAW') draws = draws.plus(amount)
    else if (row.kind === 'DIVIDEND') dividends = dividends.plus(amount)
  }
  return {
    contributions: contributions.toFixed(4),
    draws: draws.toFixed(4),
    dividends: dividends.toFixed(4),
    net: contributions.minus(draws).minus(dividends).toFixed(4),
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
