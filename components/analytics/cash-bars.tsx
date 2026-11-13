import { INCOME_COLOR, EXPENSE_COLOR } from '@/components/reports/figure-chart'
import { formatMoney } from '@/lib/money'

export function CashBars({
  months,
  currency,
  year,
}: {
  months: { label: string; amount: string }[]
  currency: string
  year: string
}) {
  const values = months.map((m) => Number(m.amount))
  const peak = Math.max(1, ...values.map((v) => Math.abs(v)))
  const width = 560
  const height = 240
  const top = 16
  const bottom = 200
  const baseline = (top + bottom) / 2
  const scale = (bottom - top) / 2 / peak
  const group = (width - 36) / Math.max(months.length, 1)
  const summary = months.map((m) => `${m.label} ${formatMoney(m.amount, currency)}`).join(', ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Cash movement ${year}: ${summary}`}
      className="h-56 w-full text-muted-foreground"
    >
      {[0.25, 0.5, 0.75].map((t) => {
        const y = baseline - ((bottom - top) / 2) * t
        const y2 = baseline + ((bottom - top) / 2) * t
        return (
          <g key={t}>
            <line x1="18" x2={width - 18} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 4" />
            <line x1="18" x2={width - 18} y1={y2} y2={y2} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 4" />
          </g>
        )
      })}
      <line x1="18" x2={width - 18} y1={baseline} y2={baseline} stroke="currentColor" strokeOpacity="0.28" />
      {months.map((month, index) => {
        const value = Number(month.amount)
        const h = Math.abs(value) * scale
        const barH = value === 0 ? 0 : Math.max(h, 3)
        const y = value >= 0 ? baseline - barH : baseline
        const x = 18 + group * index + group / 2 - 10
        return (
          <g key={month.label} className="analytics-bar-rise" style={{ animationDelay: `${index * 30}ms` }}>
            <title>{`${month.label}: ${formatMoney(month.amount, currency)}`}</title>
            <rect
              x={x}
              y={y}
              width="20"
              height={barH}
              rx="5"
              fill={value >= 0 ? INCOME_COLOR : EXPENSE_COLOR}
              opacity="0.92"
            />
            <text x={x + 10} y={height - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">
              {month.label.slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
