'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CURRENCIES, MONTH_DAYS, MONTHS } from '@/lib/constants'
import { MODULE_FLAG_LABELS } from '@/lib/feature-flags'
import {
  PACK_FAMILIES,
  packsInFamily,
  workspacePreview,
  type OnboardingAnswers,
  type PackFamilyId,
  type PackId,
  defaultOnboardingAnswers,
  recommendPackFromAnswers,
} from '@/lib/packs'
import { registerAction, type RegisterState } from './actions'

const initialState: RegisterState = {}

const STEPS = ['Industry', 'Workspace', 'Needs', 'Confirm'] as const

const SECTOR_BY_FAMILY: Record<PackFamilyId, OnboardingAnswers['sector']> = {
  trade: 'trading',
  food_stay: 'restaurant',
  health: 'hospital',
  education: 'school',
  services: 'professional',
  make_move: 'manufacturing',
  everything: 'mixed',
}

const FAMILY_TOGGLES: Record<
  PackFamilyId,
  { key: keyof OnboardingAnswers; label: string; hint: string }[]
> = {
  trade: [
    { key: 'usesPos', label: 'We use a till / Point of Sale', hint: 'Registers and receipts' },
    { key: 'multiStore', label: 'More than one store / warehouse', hint: 'Transfers between sites' },
    { key: 'needsTax', label: 'We charge sales / purchase tax', hint: 'Tax codes on documents' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Employees and payslips' },
  ],
  food_stay: [
    { key: 'usesPos', label: 'We use POS / tables', hint: 'Till and kitchen tickets' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Staff and tips' },
    { key: 'needsTax', label: 'We charge tax', hint: 'Tax on sales' },
  ],
  health: [
    { key: 'usesPos', label: 'We sell at a counter / POS', hint: 'Pharmacy till' },
    { key: 'needsApprovals', label: 'We want maker-checker approvals', hint: 'Bills wait for a checker' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Staff payslips' },
    { key: 'tracksLots', label: 'We track lots or expiry', hint: 'Batch-style stock' },
  ],
  education: [
    { key: 'needsPayroll', label: 'We run staff payroll', hint: 'Teachers and admin payslips' },
    { key: 'needsTax', label: 'We charge tax on fees', hint: 'Usually off for schools' },
  ],
  services: [
    { key: 'sellsServices', label: 'We sell services', hint: 'Invoices and projects' },
    { key: 'needsApprovals', label: 'We want approvals', hint: 'Checker before posting' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Employees' },
  ],
  make_move: [
    { key: 'manufactures', label: 'We manufacture or assemble', hint: 'Work orders / MRP' },
    { key: 'tracksLots', label: 'We track lots or serials', hint: 'Batch stock' },
    { key: 'multiStore', label: 'More than one warehouse', hint: 'Transfers and picks' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Shop-floor and office staff' },
  ],
  everything: [
    { key: 'needsTax', label: 'We charge tax', hint: 'Tax codes' },
    { key: 'needsApprovals', label: 'We want approvals', hint: 'Maker-checker' },
    { key: 'needsPayroll', label: 'We run payroll', hint: 'Employees' },
  ],
}

function stepClass(active: boolean, done: boolean) {
  if (active) return 'rounded-full bg-foreground px-3 py-1 text-background'
  if (done) return 'rounded-full bg-muted px-3 py-1 text-foreground'
  return 'rounded-full border px-3 py-1 text-muted-foreground'
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const v = state.values ?? {}

  const [step, setStep] = useState(0)
  const [familyId, setFamilyId] = useState<PackFamilyId | null>(null)
  const [packId, setPackId] = useState<PackId | null>((v.packId as PackId) || null)
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => defaultOnboardingAnswers())
  const [stepError, setStepError] = useState<string | null>(null)

  const familyPacks = useMemo(
    () => (familyId ? packsInFamily(familyId) : []),
    [familyId],
  )

  const recommendation = useMemo(() => recommendPackFromAnswers(answers), [answers])

  const preview = useMemo(
    () => (packId ? workspacePreview(packId) : null),
    [packId],
  )

  function selectFamily(id: PackFamilyId) {
    setFamilyId(id)
    setPackId(null)
    setAnswers((prev) => ({
      ...prev,
      sector: SECTOR_BY_FAMILY[id],
    }))
    setStepError(null)
  }

  function goNext() {
    setStepError(null)
    if (step === 0 && !familyId) {
      setStepError('Choose the kind of organisation you run.')
      return
    }
    if (step === 1 && !packId) {
      setStepError('Choose the workspace that fits your organisation.')
      return
    }
    if (step === 2) {
      const recommended = recommendation.packId
      const inFamily = familyPacks.some((pack) => pack.id === recommended)
      if (inFamily && familyId) {
        setPackId(recommended)
      }
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  function goBack() {
    setStepError(null)
    setStep((value) => Math.max(0, value - 1))
  }

  if (state.pending) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-foreground">Request sent — waiting for approval</p>
        <p className="text-sm text-muted-foreground">
          {state.message ??
            'You will not be able to sign in until the system owner approves your company.'}
        </p>
        <p className="text-xs text-muted-foreground">
          We will keep <span className="font-medium text-foreground">{v.email}</span> until a decision
          is made.
        </p>
        <Link href="/login/company" className="inline-block text-sm font-medium text-primary underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      {packId ? <input type="hidden" name="packId" value={packId} /> : null}

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li key={label} className={stepClass(index === step, index < step)}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {stepError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {stepError}
        </p>
      ) : null}
      {state.fieldErrors?.packId?.[0] ? (
        <p className="text-sm text-destructive">{state.fieldErrors.packId[0]}</p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">What kind of organisation is this?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a group first — we will show the right workspace next.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PACK_FAMILIES.map((family) => {
              const active = familyId === family.id
              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => selectFamily(family.id)}
                  className={
                    active
                      ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                      : 'rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/30'
                  }
                >
                  <span className="block text-sm font-medium">{family.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{family.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Choose your workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One complete setup for your organisation — you can add more apps later.
            </p>
          </div>
          <div className="grid gap-2">
            {familyPacks.map((pack) => {
              const active = packId === pack.id
              const bullets = pack.inScope.slice(0, 3)
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => {
                    setPackId(pack.id)
                    setStepError(null)
                  }}
                  className={
                    active
                      ? 'rounded-lg border-2 border-foreground bg-muted/40 p-3 text-left'
                      : 'rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/30'
                  }
                >
                  <span className="block text-sm font-medium">{pack.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{pack.blurb}</span>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    {bullets.map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">A few needs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional refinements. Your workspace stays {packId ? workspacePreview(packId)?.packLabel : 'selected'}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(familyId ? FAMILY_TOGGLES[familyId] : []).map((toggle) => {
              const checked = Boolean(answers[toggle.key])
              return (
                <label
                  key={toggle.key}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{toggle.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{toggle.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-input"
                    checked={checked}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [toggle.key]: event.target.checked }))
                    }
                  />
                </label>
              )
            })}
          </div>
          {familyId && recommendation.packId !== packId ? (
            <p className="text-xs text-muted-foreground">
              Suggestion from your answers:{' '}
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => setPackId(recommendation.packId)}
              >
                {recommendation.label}
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          {preview ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your workspace
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {preview.packLabel} · {preview.hub.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{preview.blurb}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Day-to-day desk</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {preview.daily.slice(0, 8).map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Underlying ERP</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.underlyingLoops.map((loop) => loop.title).join(' · ') || 'Books'}
                </p>
              </div>
              {preview.outOfScope.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-foreground">Not included</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {preview.outOfScope.join(' · ')}
                  </p>
                </div>
              ) : null}
              {preview.suggestedAddOns.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Later in Marketplace you can add:{' '}
                  {preview.suggestedAddOns
                    .slice(0, 4)
                    .map((flag) => MODULE_FLAG_LABELS[flag].label)
                    .join(', ')}
                  .
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-destructive">Go back and choose a workspace.</p>
          )}

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your company
            </p>

            <Field
              name="organizationName"
              label="Company name"
              required
              error={state.fieldErrors?.organizationName}
            >
              <Input
                {...fieldProps('organizationName', state.fieldErrors?.organizationName)}
                defaultValue={v.organizationName ?? ''}
                placeholder="e.g. Hodan Trading"
                autoFocus
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="baseCurrency"
                label="Base currency"
                hint="Ledger reporting currency. Locked after the first posted transaction."
                error={state.fieldErrors?.baseCurrency}
              >
                <select
                  {...fieldProps('baseCurrency', state.fieldErrors?.baseCurrency, true)}
                  defaultValue={v.baseCurrency ?? 'USD'}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                name="fiscalYearStartMonth"
                label="Fiscal year month"
                error={state.fieldErrors?.fiscalYearStartMonth}
              >
                <select
                  {...fieldProps('fiscalYearStartMonth', state.fieldErrors?.fiscalYearStartMonth)}
                  defaultValue={v.fiscalYearStartMonth ?? '1'}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                name="fiscalYearStartDay"
                label="Fiscal year day"
                error={state.fieldErrors?.fiscalYearStartDay}
              >
                <select
                  {...fieldProps('fiscalYearStartDay', state.fieldErrors?.fiscalYearStartDay)}
                  defaultValue={v.fiscalYearStartDay ?? '1'}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {MONTH_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Owner account
            </p>

            <Field name="name" label="Your name" required error={state.fieldErrors?.name}>
              <Input {...fieldProps('name', state.fieldErrors?.name)} defaultValue={v.name} required />
            </Field>

            <Field name="email" label="Email" required error={state.fieldErrors?.email}>
              <Input
                {...fieldProps('email', state.fieldErrors?.email)}
                type="email"
                autoComplete="username"
                defaultValue={v.email}
                required
              />
            </Field>

            <Field
              name="phone"
              label="Mobile (optional)"
              hint="You can also sign in with this number later."
              error={state.fieldErrors?.phone}
            >
              <Input
                {...fieldProps('phone', state.fieldErrors?.phone)}
                type="tel"
                autoComplete="tel"
                placeholder="+252 61 2345678"
                defaultValue={v.phone}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="password"
                label="Password"
                hint="At least 6 characters."
                required
                error={state.fieldErrors?.password}
              >
                <Input
                  {...fieldProps('password', state.fieldErrors?.password, true)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>

              <Field
                name="confirmPassword"
                label="Confirm password"
                required
                error={state.fieldErrors?.confirmPassword}
              >
                <Input
                  {...fieldProps('confirmPassword', state.fieldErrors?.confirmPassword)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Creating your company starts a 14-day free trial. You can sign in and open the books
            immediately.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={goBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <SubmitButton className="min-w-[10rem]" pendingLabel="Creating company…">
            Start free trial
          </SubmitButton>
        )}
      </div>
    </form>
  )
}
