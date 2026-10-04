import Link from 'next/link'

import type { CardTone } from '@/lib/card-tones'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

/**
 * A small coloured figure card. Tone sets the wash so each kind of number
 * (stock, money, danger…) is recognisable at a glance.
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: CardTone
  href?: string
  className?: string
}) {
  const body = (
    <Card tone={tone} className={cn('p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-75">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs opacity-70">{hint}</p> : null}
    </Card>
  )

  if (!href) return body
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  )
}
