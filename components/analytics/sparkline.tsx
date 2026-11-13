/** Tiny trend mark for KPI cards. */
export function Sparkline({
  values,
  color = 'var(--chart-net, #0369A1)',
  className,
}: {
  values: number[]
  color?: string
  className?: string
}) {
  if (values.length < 2) return null
  const width = 72
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1e-6)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = `M${points.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? 'h-7 w-[4.5rem]'} aria-hidden>
      <path d={area} fill={color} opacity="0.16" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
