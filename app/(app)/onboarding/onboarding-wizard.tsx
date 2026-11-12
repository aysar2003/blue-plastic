'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  defaultOnboardingAnswers,
  recommendPackFromAnswers,
  type OnboardingAnswers,
} from '@/lib/packs'
import type { OnboardingState } from '@/server/services/onboarding.service'

import { completeOnboarding, skipOnboarding } from './actions'

type PackRow = OnboardingState['packs'][number]

const STEPS = ['About you', 'How you work', 'Recommendation', 'Coverage', 'Finish'] as const

const SECTORS: { id: OnboardingAnswers['sector']; label: string; hint: string }[] = [
  { id: 'retail', label: 'Retail / shop', hint: 'Counter sales and stock' },
  { id: 'wholesale', label: 'Wholesale', hint: 'Orders and bulk stock' },
  { id: 'trading', label: 'Trading', hint: 'Buy and sell goods' },
  { id: 'manufacturing', label: 'Manufacturing', hint: 'BOM, work orders, MRP' },
  { id: 'distribution', label: 'Distribution / warehouse', hint: 'ASN, bins, picks' },
  { id: 'restaurant', label: 'Restaurant', hint: 'Tables, kitchen, tips' },
  { id: 'hotel', label: 'Hotel', hint: 'Rooms and folio' },
  { id: 'pharmacy', label: 'Pharmacy', hint: 'Lots and expiry' },
  { id: 'hospital', label: 'Hospital / clinic admin', hint: 'Visits and billing — not clinical EMR' },
  { id: 'school', label: 'School', hint: 'Fees and students' },
  { id: 'university', label: 'University', hint: 'Programs and fees' },
  { id: 'ngo', label: 'NGO / non-profit', hint: 'Funds and projects' },
  { id: 'professional', label: 'Professional services', hint: 'Time and invoices' },
  { id: 'construction', label: 'Construction', hint: 'Jobs and retention' },
  { id: 'services', label: 'General services', hint: 'Little or no stock' },
  { id: 'mixed', label: 'Mixed / full ERP', hint: 'Almost everything on' },
]

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-4 rounded border-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

export function OnboardingWizard({
  packs,
  completed,
  packLabel,
}: {
  packs: PackRow[]
  completed: boolean
  packLabel: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => defaultOnboardingAnswers())
  const [packId, setPackId] = useState<string | null>(null)
  const [seedChart, setSeedChart] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const recommendation = useMemo(() => recommendPackFromAnswers(answers), [answers])

  const selected = useMemo(() => {
    const id = packId ?? recommendation.packId
    return packs.find((pack) => pack.id === id) ?? null
  }, [packs, packId, recommendation.packId])

  function patchAnswers(partial: Partial<OnboardingAnswers>) {
    setAnswers((prev) => ({ ...prev, ...partial }))
    setPackId(null)
  }

  function finish() {
    if (!selected) {
      setError('Choose an institution first.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await completeOnboarding({ packId: selected.id, seedChart })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.replace('/settings/setup')
      router.refresh()
    })
  }

  function skip() {
    setError(null)
    startTransition(async () => {
      const result = await skipOnboarding({})
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.replace('/')
      router.refresh()
    })
  }

  function goNext() {
    if (step === 1) {
      setPackId(recommendation.packId)
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Company setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up for your business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer a few questions. We recommend the best institution pack, then install apps you can
          refine later in Settings → Apps &amp; features.
          {completed && packLabel ? ` Current pack: ${packLabel}.` : null}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index === step
                ? 'rounded-full bg-foreground px-3 py-1 text-background'
                : index < step
                  ? 'rounded-full bg-muted px-3 py-1 text-foreground'
                  : 'rounded-full border px-3 py-1 text-muted-foreground'
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">What kind of organisation is this?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTORS.map((sector) => {
              const active = answers.sector === sector.id
              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => patchAnswers({ sector: sector.id })}
                  className={
                    active
                      ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                      : 'rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/30'
                  }
                >
                  <span className="block text-sm font-medium">{sector.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{sector.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="We sell products / goods"
            hint="Inventory and stock apps stay relevant."
            checked={answers.sellsProducts}
            onChange={(sellsProducts) => patchAnswers({ sellsProducts })}
          />
          <Toggle
            label="We sell services"
            hint="Invoices and projects matter more than shelves."
            checked={answers.sellsServices}
            onChange={(sellsServices) => patchAnswers({ sellsServices })}
          />
          <Toggle
            label="We use a till / Point of Sale"
            hint="Registers and receipts."
            checked={answers.usesPos}
            onChange={(usesPos) => patchAnswers({ usesPos })}
          />
          <Toggle
            label="More than one store / warehouse"
            hint="Transfers and store tickets."
            checked={answers.multiStore}
            onChange={(multiStore) => patchAnswers({ multiStore })}
          />
          <Toggle
            label="We track lots or serials"
            hint="Batch / expiry style stock."
            checked={answers.tracksLots}
            onChange={(tracksLots) => patchAnswers({ tracksLots })}
          />
          <Toggle
            label="We manufacture or assemble"
            hint="Work orders, MRP, routings."
            checked={answers.manufactures}
            onChange={(manufactures) => patchAnswers({ manufactures })}
          />
          <Toggle
            label="We run payroll"
            hint="Employees and payslips."
            checked={answers.needsPayroll}
            onChange={(needsPayroll) => patchAnswers({ needsPayroll })}
          />
          <Toggle
            label="We charge sales / purchase tax"
            hint="Tax codes on documents."
            checked={answers.needsTax}
            onChange={(needsTax) => patchAnswers({ needsTax })}
          />
          <Toggle
            label="We want maker-checker approvals"
            hint="Documents wait for a checker before posting."
            checked={answers.needsApprovals}
            onChange={(needsApprovals) => patchAnswers({ needsApprovals })}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended: {recommendation.label}</CardTitle>
              <CardDescription>{recommendation.reason}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {recommendation.verticalStatus === 'planned' ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                  This pack&apos;s deep vertical features are still maturing. Module presets install
                  now; refine apps anytime in Settings → Apps &amp; features.
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={packId === recommendation.packId || !packId ? 'default' : 'outline'}
                onClick={() => setPackId(recommendation.packId)}
              >
                Use recommendation
              </Button>
            </CardContent>
          </Card>

          {recommendation.alternatives.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Or choose another pack</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {recommendation.alternatives.map((alt) => (
                  <button
                    key={alt.packId}
                    type="button"
                    onClick={() => setPackId(alt.packId)}
                    className={
                      packId === alt.packId
                        ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                        : 'rounded-lg border border-border p-3 text-left hover:bg-muted/30'
                    }
                  >
                    <span className="block text-sm font-medium">{alt.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{alt.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <details className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Browse all institution packs</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackId(pack.id)}
                  className={
                    selected?.id === pack.id
                      ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                      : 'rounded-lg border border-border p-3 text-left hover:bg-muted/30'
                  }
                >
                  <span className="block text-sm font-medium">{pack.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{pack.blurb}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      {step === 3 && selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.label}</CardTitle>
            <CardDescription>Honest coverage for this institution.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                In scope
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {selected.inScope.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Out of scope
              </p>
              {selected.outOfScope.length === 0 ? (
                <p className="mt-1 text-muted-foreground">None listed.</p>
              ) : (
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {selected.outOfScope.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirm {selected.label}</CardTitle>
            <CardDescription>
              After install you get a setup checklist in Settings → Setup. Turn any work area on or
              off later under Settings → Apps &amp; features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="flex flex-wrap gap-2 text-xs">
              {selected.modules.map((mod) => (
                <li key={mod} className="rounded-full border px-2.5 py-1">
                  {mod}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seedChart}
                onChange={(event) => setSeedChart(event.target.checked)}
              />
              Seed a default chart of accounts if this company has none yet
            </label>
            <p className="text-muted-foreground">
              Checklist preview: {selected.checklist.map((item) => item.label).join(' · ') || '—'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button type="button" variant="ghost" disabled={pending} onClick={skip}>
          Skip for now
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={pending || (step >= 2 && !selected)} onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={pending || !selected} onClick={finish}>
              {pending ? 'Installing…' : 'Install pack'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
