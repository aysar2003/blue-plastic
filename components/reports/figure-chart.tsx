import { Decimal, formatMoney, ZERO } from '@/lib/money'
import type { StatementSection } from '@/server/reports/statements'

/** The same three colours the rest of the books already use. */
export const INCOME_COLOR = '#0F766E'
export const EXPENSE_COLOR = '#C2410C'
export const NET_COLOR = '#0369A1'

export type ChartBar = {
  label: string
  value: Decimal
  comparison?: Decimal
  color: string
}

/**
 * Income, cost and profit drawn as bars, so the statement can be read before
 * the rows. A second, lighter bar appears when the report is compared with
 * another period.
 */
export function FigureChart({
  caption,
  bars,
  currency,
  comparisonLabel,
}: {
  caption: string
  bars: ChartBar[]
  currency: string
  comparisonLabel?: string
}) {
  const numbers = bars.flatMap((bar) => [
    bar.value.toNumber(),
    ...(comparisonLabel && bar.comparison ? [bar.comparison.toNumber()] : []),
  ])
  const peak = Math.max(1, ...numbers.map((value) => Math.abs(value)))
  const negative = numbers.some((value) => value < 0)
  const top = 8
  const bottom = 128
  const baseline = negative ? (top + bottom) / 2 : bottom
  const scale = (negative ? (bottom - top) / 2 : bottom - top) / peak
  const width = 480
  const groupWidth = (width - 24) / Math.max(bars.length, 1)

  const box = (value: number) => {
    const height = Math.abs(value) * scale
    return {
      y: value >= 0 ? baseline - height : baseline,
      height: value === 0 ? 0 : Math.max(height, 1.5),
    }
  }

  const summary = bars
    .map((bar) => `${bar.label} ${formatMoney(bar.value, currency)}`)
    .join(', ')

  return (
    <figure className="rounded-xl bg-[#e4ebf2] px-4 py-4 ring-1 ring-slate-300/70">
      <figcaption className="text-sm font-medium text-slate-800">{caption}</figcaption>
      <svg
        viewBox={`0 0 ${width} 168`}
        role="img"
        aria-label={summary}
        className="mt-2 h-44 w-full"
      >
        <line x1="12" x2={width - 12} y1={baseline} y2={baseline} stroke="#94a3b8" strokeWidth="1" />
        {bars.map((bar, index) => {
          const center = 12 + groupWidth * index + groupWidth / 2
          const current = box(bar.value.toNumber())
          const prior = comparisonLabel && bar.comparison ? box(bar.comparison.toNumber()) : null
          const currentX = prior ? center + 4 : center - 14
          return (
            <g key={bar.label}>
              {prior ? (
                <rect
                  x={center - 32}
                  y={prior.y}
                  width="26"
                  height={prior.height}
                  rx="3"
                  fill={bar.color}
                  opacity="0.35"
                />
              ) : null}
              <rect x={currentX} y={current.y} width="26" height={current.height} rx="3" fill={bar.color} />
              <text x={center} y="152" textAnchor="middle" fontSize="12" fill="#334155">
                {bar.label}
              </text>
            </g>
          )
        })}
      </svg>
      {comparisonLabel ? (
        <p className="mb-2 flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-slate-700" /> This period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-slate-700/35" /> {comparisonLabel}
          </span>
        </p>
      ) : null}
      <ul className={`grid gap-3 ${bars.length > 3 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {bars.map((bar) => (
          <li key={bar.label} className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: bar.color }} />
              {bar.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular text-slate-900">
              {formatMoney(bar.value, currency)}
            </p>
            {comparisonLabel && bar.comparison ? (
              <p className="text-xs tabular text-slate-500">
                {comparisonLabel}: {formatMoney(bar.comparison, currency)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Income, expenses and profit from a profit-and-loss section list. */
export function statementPicture(sections: StatementSection[], field: 'total' | 'comparisonTotal') {
  const amount = (key: string) => sections.find((section) => section.key === key)?.[field] ?? ZERO
  const income = amount('income').plus(amount('otherIncome'))
  const expenses = amount('cogs').plus(amount('expenses')).plus(amount('otherExpense'))
  return { income, expenses, net: income.minus(expenses) }
}

/**
 * One bar split by how long money has been outstanding.
 * Empty slices are left out so a current balance reads as one colour.
 */
export function ShareBar({
  caption,
  segments,
  currency,
}: {
  caption: string
  segments: { label: string; value: Decimal; color: string }[]
  currency: string
}) {
  const shown = segments.filter((segment) => !segment.value.isZero())
  const total = shown.reduce((sum, segment) => sum.plus(segment.value.abs()), ZERO)
  if (shown.length === 0 || total.isZero()) return null

  return (
    <figure className="rounded-xl bg-[#e4ebf2] px-4 py-4 ring-1 ring-slate-300/70">
      <figcaption className="text-sm font-medium text-slate-800">{caption}</figcaption>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-300/70">
        {shown.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: `${segment.value.abs().dividedBy(total).times(100).toNumber()}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${formatMoney(segment.value, currency)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {shown.map((segment) => (
          <li key={segment.label} className="text-xs text-slate-600">
            <span className="mr-1.5 inline-block size-2.5 rounded-sm align-middle" style={{ backgroundColor: segment.color }} />
            {segment.label}{' '}
            <span className="font-semibold tabular text-slate-900">{formatMoney(segment.value, currency)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
