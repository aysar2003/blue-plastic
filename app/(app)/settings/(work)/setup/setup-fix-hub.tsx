'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  applyRetailShopProfile,
  ensureLocalizationFromCountry,
  healCustomerCountriesFromOrg,
  healMissingItemSkus,
  healMissingReorderPoints,
  healOrgCountryFromPack,
  seedLocalizationTax,
} from '@/app/(app)/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SetupHealth } from '@/server/services/setup-health.service'

export function SetupFixHub({
  health,
  canEdit,
}: {
  health: SetupHealth
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  function run(
    label: string,
    fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>,
    summarize: (data: unknown) => string,
  ) {
    setError(null)
    setNote(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setNote(`${label}: ${summarize(result.data)}`)
      router.refresh()
    })
  }

  const gaps: { label: string; href: string; tone: 'ok' | 'warn' }[] = [
    {
      label: health.installedPackLabel
        ? `Pack: ${health.installedPackLabel}`
        : 'No institution pack',
      href: '/onboarding',
      tone: health.installedPackId ? 'ok' : 'warn',
    },
    {
      label: health.localizationReady
        ? `Locale: ${(health.localizationPackId ?? '').toUpperCase()} · ${health.country ?? '—'}`
        : health.country
          ? `Country ${health.country} — pack missing`
          : 'Country + localization pack missing',
      href: '/settings/organization',
      tone: health.localizationReady ? 'ok' : 'warn',
    },
    {
      label: health.orgCountryMissing
        ? 'Organisation country missing'
        : `Org country ${health.country}`,
      href: '/settings/organization',
      tone: health.orgCountryMissing ? 'warn' : 'ok',
    },
    {
      label: health.enableTax
        ? 'Tax enabled'
        : 'Tax off — seed locale tax when ready',
      href: '/settings/tax',
      tone: 'ok',
    },
    {
      label: `${health.modulesOn} apps on · ${health.modulesGranted} granted`,
      href: '/settings/features',
      tone: health.modulesOn > 25 ? 'warn' : 'ok',
    },
    {
      label:
        health.itemsMissingSku > 0
          ? `${health.itemsMissingSku} of ${health.itemsTotal} items missing SKU`
          : `${health.itemsTotal} items · SKUs ok`,
      href: '/items',
      tone: health.itemsMissingSku > 0 ? 'warn' : 'ok',
    },
    {
      label:
        health.stockMissingReorder > 0
          ? `${health.stockMissingReorder} stock items without reorder point`
          : 'Reorder points set (or no stock items)',
      href: '/inventory/replenish',
      tone: health.stockMissingReorder > 0 ? 'warn' : 'ok',
    },
    {
      label:
        health.customersMissingBillingCountry > 0
          ? `${health.customersMissingBillingCountry} of ${health.customersTotal} customers missing country`
          : `${health.customersTotal} customers · country ok`,
      href: '/customers',
      tone: health.customersMissingBillingCountry > 0 ? 'warn' : 'ok',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fix weaknesses</CardTitle>
        <CardDescription>
          Retail apps, localization tax seeds, and master-data heals — without removing forms or
          power.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

        <ul className="space-y-2">
          {gaps.map((gap) => (
            <li
              key={gap.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span className={gap.tone === 'warn' ? 'text-amber-800 dark:text-amber-200' : ''}>
                {gap.label}
              </span>
              <Link href={gap.href} className="shrink-0 text-xs underline underline-offset-4">
                Open
              </Link>
            </li>
          ))}
        </ul>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run('Retail profile', () => applyRetailShopProfile(undefined), (data) => {
                  const d = data as { modulesOn: string[] }
                  return `${d.modulesOn.length} apps visible`
                })
              }
            >
              Apply retail shop profile
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run('Localization', () => ensureLocalizationFromCountry(undefined), (data) => {
                  const d = data as {
                    applied: boolean
                    localizationPackId: string | null
                  }
                  if (d.applied) return `pack ${String(d.localizationPackId).toUpperCase()}`
                  if (d.localizationPackId) return `already ${String(d.localizationPackId).toUpperCase()}`
                  return 'set country SO/KE/ET/DJ first'
                })
              }
            >
              Auto localization from country
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  'Locale tax',
                  () => seedLocalizationTax({ enableTax: true }),
                  (data) => {
                    const d = data as { created: boolean; agencyName?: string; skipped?: string }
                    if (d.created) return `seeded ${d.agencyName}`
                    return d.skipped === 'agencies_exist' ? 'agencies already exist' : 'done'
                  },
                )
              }
            >
              Seed tax for localization pack
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run('SKUs', () => healMissingItemSkus(undefined), (data) => {
                  const d = data as { healed: number }
                  return `${d.healed} filled`
                })
              }
            >
              Generate SKUs from names
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run('Reorder', () => healMissingReorderPoints(undefined), (data) => {
                  const d = data as { healed: number }
                  return `${d.healed} set to 1`
                })
              }
            >
              Default reorder points
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run('Customer country', () => healCustomerCountriesFromOrg(undefined), (data) => {
                  const d = data as { healed: number; country: string }
                  return `${d.healed} → ${d.country}`
                })
              }
            >
              Default customer country
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run('Org country', () => healOrgCountryFromPack(undefined), (data) => {
                  const d = data as { applied: boolean; country: string }
                  return d.applied ? d.country : `already ${d.country}`
                })
              }
            >
              Country from pack
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/settings/features">Hide apps manually</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
