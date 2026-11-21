import { Decimal, ZERO } from '@/lib/money'

export type PatronageMember = {
  shareholderId: string
  name: string
  memberKind: 'MEMBER' | 'INVESTOR'
  customerId: string | null
  weight: Decimal
}

export type PatronageShare = {
  shareholderId: string
  name: string
  amount: string
  weight: string
}

/** Allocate net patronage pool by sales weight among MEMBER rows; equal split if all weights zero. */
export function allocatePatronage(
  members: PatronageMember[],
  netIncome: Decimal.Value,
  percentOfNet: Decimal.Value,
): { pool: string; shares: PatronageShare[] } {
  const eligible = members.filter((m) => m.memberKind === 'MEMBER')
  const pool = new Decimal(netIncome).times(new Decimal(percentOfNet)).div(100).toDecimalPlaces(4)
  const use = eligible.length > 0 ? eligible : members
  let totalWeight = ZERO
  for (const row of use) totalWeight = totalWeight.plus(row.weight)
  const equal = totalWeight.isZero()
  const shares: PatronageShare[] = []
  for (const row of use) {
    const portion = equal
      ? pool.div(use.length)
      : pool.times(row.weight).div(totalWeight)
    shares.push({
      shareholderId: row.shareholderId,
      name: row.name,
      amount: portion.toDecimalPlaces(4).toFixed(4),
      weight: row.weight.toFixed(4),
    })
  }
  return { pool: pool.toFixed(4), shares }
}

export function patronageMemberCsvRows(shares: PatronageShare[]): string[][] {
  return [
    ['shareholderId', 'name', 'weight', 'allocation'],
    ...shares.map((s) => [s.shareholderId, s.name, s.weight, s.amount]),
  ]
}

export function patronageCsv(shares: PatronageShare[]): string {
  const header = 'shareholderId,name,weight,allocation'
  const body = shares.map(
    (s) => `${s.shareholderId},${csvEscape(s.name)},${s.weight},${s.amount}`,
  )
  return [header, ...body].join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}