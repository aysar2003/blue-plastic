'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OnboardingState } from '@/server/services/onboarding.service'

import { completeOnboarding, skipOnboarding } from './actions'

type PackRow = OnboardingState['packs'][number]

const STEPS = ['Institution', 'Coverage', 'Apps', 'Finish'] as const

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
  const [packId, setPackId] = useState<string | null>(null)
  const [seedChart, setSeedChart] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected = useMemo(
    () => packs.find((pack) => pack.id === packId) ?? null,
    [packs, packId],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, PackRow[]>()
    for (const pack of packs) {
      const list = map.get(pack.category) ?? []
      list.push(pack)
      map.set(pack.category, list)
    }
    return [...map.entries()]
  }, [packs])

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Company setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose your institution</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick how this company works. Apps and a short setup checklist follow from the pack.
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
        <div className="space-y-6">
          {byCategory.map(([category, rows]) => (
            <section key={category} className="space-y-2">
              <h2 className="text-sm font-semibold capitalize">{category.replaceAll('_', ' ')}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {rows.map((pack) => {
                  const active = pack.id === packId
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setPackId(pack.id)}
                      className={
                        active
                          ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                          : 'rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/30'
                      }
                    >
                      <span className="block text-sm font-medium">{pack.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{pack.blurb}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {step === 1 && selected ? (
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

      {step === 2 && selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apps this pack turns on</CardTitle>
            <CardDescription>
              {selected.modules.length} apps. You can refine later in Settings → Apps & features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2 text-xs">
              {selected.modules.map((mod) => (
                <li key={mod} className="rounded-full border px-2.5 py-1">
                  {mod}
                </li>
              ))}
            </ul>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={seedChart}
                onChange={(event) => setSeedChart(event.target.checked)}
              />
              Seed a default chart of accounts if this company has none yet
            </label>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirm {selected.label}</CardTitle>
            <CardDescription>
              After install you will get a short setup checklist in Settings → Setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
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
            <Button
              type="button"
              disabled={pending || !selected}
              onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
            >
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
