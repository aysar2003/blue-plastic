import Link from 'next/link'

import { formatMoney } from '@/lib/money'

import type { HomeKpiKey } from '@/lib/dashboard-prefs'

export function HomeKpiCards({
  currency,
  profitMtd,
  openAr,
  reorderCount,
  pipelineAmount,
  pipelineCount,
  unpaidAp,
  followUps,
  pinnedKeys,
}: {
  currency: string
  profitMtd: string | null
  openAr: string | null
  reorderCount: number | null
  pipelineAmount?: string | null
  pipelineCount?: number | null
  unpaidAp?: string | null
  followUps?: number | null
  pinnedKeys?: readonly HomeKpiKey[]
}) {
  const pins = pinnedKeys ?? (['profitMtd', 'openAr', 'reorder', 'pipeline'] as const)
  const cards: { label: string; value: string; href: string }[] = []
  if (profitMtd != null && pins.includes('profitMtd')) {
    cards.push({
      label: 'Profit (this calendar month)',
      value: formatMoney(profitMtd, currency),
      href: '/reports/business-overview',
    })
  }
  if (openAr != null && pins.includes('openAr')) {
    cards.push({
      label: 'Customers still owe',
      value: formatMoney(openAr, currency),
      href: '/reports/ar-aging',
    })
  }
  if (reorderCount != null && reorderCount > 0 && pins.includes('reorder')) {
    cards.push({
      label: 'Products to reorder',
      value: String(reorderCount),
      href: '/reports/inventory-reorder',
    })
  }
  if (pipelineAmount != null && pins.includes('pipeline')) {
    cards.push({
      label: pipelineCount ? `Pipeline (${pipelineCount})` : 'Open pipeline',
      value: formatMoney(pipelineAmount, currency),
      href: '/customers/pipeline',
    })
  }
  if (unpaidAp != null && pins.includes('unpaidAp')) {
    cards.push({
      label: 'Unpaid bills',
      value: formatMoney(unpaidAp, currency),
      href: '/reports/ap-aging',
    })
  }
  if (followUps != null && followUps > 0 && pins.includes('followUps')) {
    cards.push({
      label: 'Open follow-ups',
      value: String(followUps),
      href: '/customers/tickets',
    })
  }
  if (cards.length === 0) return null

  return (
    <div className="mx-auto grid w-full gap-3 px-[clamp(0.75rem,2vw,2.5rem)] pt-8 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{card.value}</p>
        </Link>
      ))}
    </div>
  )
}
