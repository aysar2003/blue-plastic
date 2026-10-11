import Link from 'next/link'

import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { StatementSection } from '@/server/reports/statements'

/** Theme-aware chart colours (overridden on html.odoo / html.quick). */
export const INCOME_COLOR = 'var(--chart-income, #0F766E)'
export const EXPENSE_COLOR = 'var(--chart-expense, #C2410C)'
export const NET_COLOR = 'var(--chart-net, #0369A1)'

export type ChartBar = {
  label: string
  value: Decimal
  comparison?: Decimal
  color: string
  /** Opens a report when the summary figure is clicked. */
  href?: string
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
    <figure className="figure-chart rounded-xl bg-[#e4ebf2] px-4 py-4 ring-1 ring-slate-300/70">
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
        {bars.map((bar) => {
          const body = (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Swatch color={bar.color} selected={false} />
                {bar.label}
              </p>
              <p className="mt-1 text-base font-semibold tabular text-slate-950">
                {formatMoney(bar.value, currency)}
              </p>
              {comparisonLabel && bar.comparison ? (
                <p className="text-sm tabular text-slate-500">
                  {comparisonLabel}: {formatMoney(bar.comparison, currency)}
                </p>
              ) : null}
            </>
          )
          return (
            <li key={bar.label} className="min-w-0">
              {bar.href ? (
                <Link
                  href={bar.href}
                  className="block rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="px-1 py-0.5">{body}</div>
              )}
            </li>
          )
        })}
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

export type ShareSegment = {
  /** Stable id so a click can pick this slice out of the report below. */
  id?: string
  label: string
  value: Decimal
  color: string
  /** URL filter for this age — same idea as the chart-of-accounts chips. */
  href?: string
}

/**
 * One bar split by how long money has been outstanding.
 * Empty slices are left out so a current balance reads as one colour.
 * When a slice carries an `href`, the bar and its key open that filter.
 */
export function ShareBar({
  caption,
  segments,
  currency,
  activeId = null,
}: {
  caption: string
  segments: ShareSegment[]
  currency: string
  activeId?: string | null
}) {
  const shown = segments.filter((segment) => !segment.value.isZero())
  const total = shown.reduce((sum, segment) => sum.plus(segment.value.abs()), ZERO)
  if (shown.length === 0 || total.isZero()) return null

  return (
    <figure className="rounded-xl bg-[#e4ebf2] px-4 py-4 ring-1 ring-slate-300/70">
      <figcaption className="text-base font-medium text-slate-800">{caption}</figcaption>
      <div className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-full bg-white p-1 ring-1 ring-slate-300/70">
        {shown.map((segment) => {
          const amount = formatMoney(segment.value, currency)
          const share = segment.value.abs().dividedBy(total).times(100).toNumber()
          const selected = Boolean(segment.id && activeId === segment.id)
          const dimmed = Boolean(activeId && segment.id && !selected)
          const className = cn(
            'h-full min-w-1 rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/50',
            dimmed && 'opacity-35',
            segment.href && 'hover:opacity-90',
          )
          const style = { flexGrow: share, flexBasis: 0, backgroundColor: segment.color }
          const label = `${segment.label}: ${amount}`
          if (segment.href) {
            return (
              <Link
                key={segment.label}
                href={segment.href}
                className={className}
                style={style}
                title={label}
                aria-current={selected ? 'page' : undefined}
                aria-label={`${label}. Show this in the report below.`}
                scroll={false}
              />
            )
          }
          return <div key={segment.label} className={className} style={style} title={label} />
        })}
      </div>
      <ul className="mt-3.5 flex flex-wrap gap-2">
        {shown.map((segment) => {
          const amount = formatMoney(segment.value, currency)
          const selected = Boolean(segment.id && activeId === segment.id)
          const body = (
            <>
              <Swatch color={segment.color} selected={selected} />
              <span className="text-slate-700">{segment.label}</span>
              <span className="font-semibold tabular text-slate-950">{amount}</span>
            </>
          )
          return (
            <li key={segment.label}>
              {segment.href ? (
                <Link
                  href={segment.href}
                  aria-current={selected ? 'page' : undefined}
                  scroll={false}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40',
                    selected ? 'bg-white text-slate-900' : 'text-slate-700 hover:bg-white/80',
                  )}
                  style={selected ? { boxShadow: `0 0 0 1.5px ${segment.color}` } : undefined}
                >
                  {body}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 px-1 py-1 text-sm text-slate-700">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

/** A soft halo around a solid centre, so each age reads as its own mark. */
function Swatch({ color, selected }: { color: string; selected: boolean }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex size-4 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: `${color}2e` }}
    >
      <span
        className={cn('rounded-full shadow-[0_0_0_1.5px_white]', selected ? 'size-2.5' : 'size-2')}
        style={{ backgroundColor: color }}
      />
    </span>
  )
}
