import { NET_COLOR } from '@/components/reports/figure-chart'
import { formatMoney } from '@/lib/money'

export function SalesLine({
  days,
  currency,
}: {
  days: { day: string; amount: string }[]
  currency: string
}) {
  const width = 640
  const height = 240
  const padX = 36
  const padTop = 18
  const padBottom = 32
  const plotH = height - padTop - padBottom
  const plotW = width - padX * 2
  const values = days.map((d) => Number(d.amount))
  const peak = Math.max(1, ...values)

  if (days.length === 0) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No sales days in this month.
      </p>
    )
  }

  const points = days.map((day, index) => {
    const x = padX + (days.length <= 1 ? plotW / 2 : (plotW * index) / (days.length - 1))
    const y = padTop + plotH - (Number(day.amount) / peak) * plotH
    return { x, y, day }
  })

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${points[points.length - 1]!.x.toFixed(1)},${padTop + plotH} L${points[0]!.x.toFixed(1)},${padTop + plotH} Z`
  const gradId = 'analytics-sales-area'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Daily sales, peak ${formatMoney(String(peak), currency)}`}
      className="h-56 w-full text-muted-foreground"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NET_COLOR} stopOpacity="0.45" />
          <stop offset="100%" stopColor={NET_COLOR} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = padTop + plotH * (1 - t)
        return (
          <line
            key={t}
            x1={padX}
            x2={width - 12}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeDasharray="4 5"
          />
        )
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={NET_COLOR}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point) => (
        <g key={point.day.day}>
          <title>{`${point.day.day}: ${formatMoney(point.day.amount, currency)}`}</title>
          <circle
            cx={point.x}
            cy={point.y}
            r="4"
            fill="var(--card, #ffffff)"
            stroke={NET_COLOR}
            strokeWidth="2.5"
          />
        </g>
      ))}
      {points
        .filter(
          (_, i) =>
            i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0,
        )
        .map((point) => (
          <text
            key={`lbl-${point.day.day}`}
            x={point.x}
            y={height - 10}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="currentColor"
          >
            {point.day.day.slice(8)}
          </text>
        ))}
    </svg>
  )
}
