'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { GroupReportView } from '@/lib/company-group'

type CompanyOption = {
  id: string
  name: string
  parentOrgId: string | null
}

/**
 * One company · each company · combined group.
 * Writes `view` and `org` into the URL so the server can filter the report.
 */
export function CompanyReportScope({
  view,
  selectedOrgId,
  companies,
  currentOrgId,
}: {
  view: GroupReportView
  selectedOrgId: string | null
  companies: CompanyOption[]
  currentOrgId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  if (companies.length < 2) return null

  const apply = (nextView: GroupReportView, orgId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', nextView)
    if (nextView === 'one' && orgId) params.set('org', orgId)
    else params.delete('org')
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const modes: { value: GroupReportView; label: string; hint: string }[] = [
    {
      value: 'one',
      label: 'One company',
      hint: 'Full figures for a single company in the group',
    },
    {
      value: 'each',
      label: 'Each company',
      hint: 'Side by side — every company keeps its own books',
    },
    {
      value: 'combined',
      label: 'Combined',
      hint: 'Group total in the same currency (books stay separate)',
    },
  ]

  return (
    <div
      className={cn(
        'mb-4 space-y-3 rounded-lg border bg-card px-4 py-3 print:hidden',
        pending && 'opacity-70',
      )}
    >
      <div>
        <p className="text-sm font-medium">Company scope</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose one company, see each separately, or the combined group profit and loss.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Company report scope">
        {modes.map((mode) => {
          const active = view === mode.value
          return (
            <button
              key={mode.value}
              type="button"
              title={mode.hint}
              aria-pressed={active}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
              )}
              onClick={() =>
                apply(
                  mode.value,
                  mode.value === 'one'
                    ? selectedOrgId ?? currentOrgId ?? companies[0]?.id ?? null
                    : null,
                )
              }
            >
              {mode.label}
            </button>
          )
        })}
      </div>

      {view === 'one' ? (
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="group-report-org">Company</Label>
          <NativeSelect
            id="group-report-org"
            value={selectedOrgId ?? ''}
            onChange={(event) => apply('one', event.target.value || null)}
          >
            {companies.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.parentOrgId ? ' (Sub)' : ' (Main)'}
                {row.id === currentOrgId ? ' · Current' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
    </div>
  )
}
