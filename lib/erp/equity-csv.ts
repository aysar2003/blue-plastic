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

export function shareholderRegisterCsv(rows: ShareholderRegisterRow[]): string {
  const header = 'name,shares,ownershipPercent,capitalAccount'
  const body = rows.map(
    (row) =>
      `${csvEscape(row.name)},${row.shares},${row.ownershipPercent},${csvEscape(row.capitalAccount ?? '')}`,
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

export function equityMovementCsv(rows: EquityMovementRow[]): string {
  const header = 'date,kind,shareholder,amount,memo,equityAccount'
  const body = rows.map(
    (row) =>
      `${row.date},${csvEscape(row.kind)},${csvEscape(row.shareholder)},${row.amount},${csvEscape(row.memo)},${csvEscape(row.equityAccount)}`,
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
