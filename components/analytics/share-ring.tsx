import { EXPENSE_COLOR, INCOME_COLOR } from '@/components/reports/figure-chart'
import { Decimal, formatMoney } from '@/lib/money'

export function ShareRing({
  costOfSales,
  other,
  currency,
}: {
  costOfSales: string
  other: string
  currency: string
}) {
  const cogs = new Decimal(costOfSales)
  const rest = new Decimal(other)
  const total = cogs.plus(rest)
  if (total.isZero()) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No spending in this month.
      </p>
    )
  }

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = 72
  const stroke = 28
  const c = 2 * Math.PI * r
  const cogsShare = cogs.dividedBy(total).toNumber()
  const cogsLen = cogsShare * c
  const otherLen = c - cogsLen
  const cogsPct = Math.round(cogsShare * 100)

  return (
    <div className="flex h-56 flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-44 shrink-0" role="img" aria-label="Spending mix">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={INCOME_COLOR}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${cogsLen} ${otherLen}`}
          strokeDashoffset={c / 4}
          className="analytics-fade-in"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={EXPENSE_COLOR}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${otherLen} ${cogsLen}`}
          strokeDashoffset={c / 4 - cogsLen}
          className="analytics-fade-in"
          style={{ animationDelay: '80ms' }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground"
          fontSize="22"
          fontWeight="700"
        >
          {cogsPct}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground" fontSize="11">
          cost of sales
        </text>
      </svg>
      <ul className="w-full max-w-[12rem] space-y-3 text-sm">
        <li className="rounded-xl bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: INCOME_COLOR }} />
            <span className="text-muted-foreground">Cost of sales</span>
          </div>
          <p className="mt-1 text-base font-semibold tabular-nums">{formatMoney(costOfSales, currency)}</p>
        </li>
        <li className="rounded-xl bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: EXPENSE_COLOR }} />
            <span className="text-muted-foreground">Other</span>
          </div>
          <p className="mt-1 text-base font-semibold tabular-nums">{formatMoney(other, currency)}</p>
        </li>
        <li className="px-1 text-xs text-muted-foreground">
          Total {formatMoney(total.toFixed(2), currency)}
        </li>
      </ul>
    </div>
  )
}
