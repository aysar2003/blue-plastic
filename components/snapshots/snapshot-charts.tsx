import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const INCOME = '#0F766E'
const EXPENSE = '#C2410C'
const PAID = '#15803D'
const UNPAID = '#1D4ED8'
const OVERDUE = '#B91C1C'
const OTHER = '#64748B'

export function DualBarChart({
  rows,
  currency,
  aKey,
  bKey,
  aLabel,
  bLabel,
  aColor = INCOME,
  bColor = EXPENSE,
}: {
  rows: { label: string; a: string; b: string }[]
  currency: string
  aKey?: string
  bKey?: string
  aLabel: string
  bLabel: string
  aColor?: string
  bColor?: string
}) {
  void aKey
  void bKey
  const peak = Math.max(
    1,
    ...rows.flatMap((row) => [Math.abs(Number(row.a)), Math.abs(Number(row.b))]),
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: aColor }} />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: bColor }} />
          {bLabel}
        </span>
      </div>
      <div className="flex h-40 items-end gap-1.5 sm:gap-2">
        {rows.map((row) => {
          const aH = (Math.abs(Number(row.a)) / peak) * 100
          const bH = (Math.abs(Number(row.b)) / peak) * 100
          return (
            <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-0.5">
                <div
                  className="snapshot-bar w-[45%] min-w-[3px] rounded-t-sm"
                  style={{ height: `${Math.max(aH, Number(row.a) === 0 ? 0 : 2)}%`, background: aColor }}
                  title={`${aLabel}: ${formatMoney(row.a, currency)}`}
                />
                <div
                  className="snapshot-bar w-[45%] min-w-[3px] rounded-t-sm"
                  style={{ height: `${Math.max(bH, Number(row.b) === 0 ? 0 : 2)}%`, background: bColor }}
                  title={`${bLabel}: ${formatMoney(row.b, currency)}`}
                />
              </div>
              <span className="truncate text-[0.65rem] text-muted-foreground">{row.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HBarList({
  rows,
  currency,
  color = INCOME,
}: {
  rows: { id: string; name: string; amount: string }[]
  currency: string
  color?: string
}) {
  if (rows.length === 0) return null
  const peak = Math.max(1, ...rows.map((row) => Math.abs(Number(row.amount))))
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const width = Math.min(100, (Math.abs(Number(row.amount)) / peak) * 100)
        return (
          <li key={row.id}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular text-muted-foreground">
                {formatMoney(row.amount, currency)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function StatusPie({
  paid,
  unpaid,
  overdue,
  currency,
}: {
  paid: string
  unpaid: string
  overdue: string
  currency: string
}) {
  const p = new Decimal(paid)
  const u = new Decimal(unpaid)
  const o = new Decimal(overdue)
  // Unpaid ring uses unpaid; overdue is a portion callout, not a third pie slice of the same money.
  const total = p.plus(u)
  if (total.isZero()) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No invoice activity.</p>
  }

  const size = 160
  const r = 54
  const stroke = 22
  const c = 2 * Math.PI * r
  const paidShare = p.dividedBy(total).toNumber()
  const paidLen = paidShare * c
  const unpaidLen = c - paidLen

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-36 shrink-0" role="img" aria-label="Payment status">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={PAID}
          strokeWidth={stroke}
          strokeDasharray={`${paidLen} ${unpaidLen}`}
          strokeDashoffset={c / 4}
          strokeLinecap="butt"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={UNPAID}
          strokeWidth={stroke}
          strokeDasharray={`${unpaidLen} ${paidLen}`}
          strokeDashoffset={c / 4 - paidLen}
          strokeLinecap="butt"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[0.65rem] font-semibold"
        >
          {formatMoney(total, currency)}
        </text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        <LegendRow color={PAID} label="Paid" amount={formatMoney(paid, currency)} />
        <LegendRow color={UNPAID} label="Unpaid" amount={formatMoney(unpaid, currency)} />
        <LegendRow color={OVERDUE} label="Of which overdue" amount={formatMoney(overdue, currency)} />
      </ul>
    </div>
  )
}

export function ExpenseDonut({
  rows,
  total,
  currency,
}: {
  rows: { id: string; name: string; amount: string }[]
  total: string
  currency: string
}) {
  if (rows.length === 0 || new Decimal(total).isZero()) return null
  const colors = [EXPENSE, '#EA580C', '#A16207', OTHER, '#0F766E', '#1D4ED8', '#7C3AED', '#BE123C']
  const absTotal = rows.reduce((sum, row) => sum.plus(new Decimal(row.amount).abs()), ZERO_DEC)
  const size = 160
  const r = 54
  const stroke = 22
  const c = 2 * Math.PI * r
  let offset = c / 4

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-36 shrink-0" role="img" aria-label="Expense breakdown">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={stroke} />
        {rows.map((row, index) => {
          const share = absTotal.isZero()
            ? 0
            : new Decimal(row.amount).abs().dividedBy(absTotal).toNumber()
          const len = share * c
          const dashoffset = offset
          offset -= len
          return (
            <circle
              key={row.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={dashoffset}
            />
          )
        })}
      </svg>
      <ul className="max-h-40 w-full space-y-1 overflow-y-auto text-sm">
        {rows.map((row, index) => (
          <LegendRow
            key={row.id}
            color={colors[index % colors.length]}
            label={row.name}
            amount={formatMoney(row.amount, currency)}
          />
        ))}
        <li className="pt-1 text-xs font-semibold text-muted-foreground">
          Total {formatMoney(total, currency)}
        </li>
      </ul>
    </div>
  )
}

function LegendRow({ color, label, amount }: { color: string; label: string; amount: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className={cn('size-2.5 shrink-0 rounded-sm')} style={{ background: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 tabular text-muted-foreground">{amount}</span>
    </li>
  )
}

const ZERO_DEC = new Decimal(0)

export function YearBars({
  years,
  currency,
  color = EXPENSE,
}: {
  years: { label: string; amount: string }[]
  currency: string
  color?: string
}) {
  if (years.length === 0) return null
  const peak = Math.max(1, ...years.map((y) => Math.abs(Number(y.amount))))
  return (
    <div className="flex h-40 items-end gap-2">
      {years.map((year, index) => {
        const h = (Math.abs(Number(year.amount)) / peak) * 100
        return (
          <div key={year.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[0.65rem] tabular text-muted-foreground">
              {formatMoney(year.amount, currency)}
            </span>
            <div
              className="snapshot-bar w-full max-w-10 rounded-t-md"
              style={{
                height: `${Math.max(h, Number(year.amount) === 0 ? 0 : 4)}%`,
                background: color,
                animationDelay: `${index * 45}ms`,
              }}
              title={`${year.label}: ${formatMoney(year.amount, currency)}`}
            />
            <span className="text-[0.7rem] font-medium text-muted-foreground">{year.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function SparkArea({
  rows,
  currency,
}: {
  rows: { id: string; name: string; amount: string }[]
  currency: string
}) {
  if (rows.length === 0) return null
  const values = rows.map((row) => Number(row.amount))
  const peak = Math.max(1, ...values.map((v) => Math.abs(v)))
  const w = 320
  const h = 120
  const step = rows.length <= 1 ? w : w / (rows.length - 1)
  const points = values
    .map((value, index) => {
      const x = index * step
      const y = h - (Math.abs(value) / peak) * (h - 8) - 4
      return `${x},${y}`
    })
    .join(' ')
  const area = `0,${h} ${points} ${w},${h}`

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full snapshot-fade-in" role="img" aria-label="Sales history">
        <defs>
          <linearGradient id="snapshotSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INCOME} stopOpacity="0.35" />
            <stop offset="100%" stopColor={INCOME} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#snapshotSparkFill)" />
        <polyline
          points={points}
          fill="none"
          stroke={INCOME}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] text-muted-foreground">
        <span>{rows[0]?.name}</span>
        <span className="tabular">{formatMoney(rows[rows.length - 1]?.amount ?? '0', currency)}</span>
        <span>{rows[rows.length - 1]?.name}</span>
      </div>
    </div>
  )
}

export function AgingBars({
  slices,
  currency,
}: {
  slices: { key: string; label: string; amount: string }[]
  currency: string
}) {
  const peak = Math.max(1, ...slices.map((s) => Math.abs(Number(s.amount))))
  return (
    <div className="space-y-2">
      {slices.map((slice) => {
        const width = Math.min(100, (Math.abs(Number(slice.amount)) / peak) * 100)
        return (
          <div key={slice.key}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{slice.label}</span>
              <span className="tabular">{formatMoney(slice.amount, currency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${Number(slice.amount) === 0 ? 0 : Math.max(width, 2)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
