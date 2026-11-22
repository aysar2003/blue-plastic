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
  needsForPack,
  defaultNeedsSelection,
  packNeedsAcademicYear,
  defaultAcademicCalendar,
  type OnboardingAnswers,
  type PackFamilyId,
  type PackId,
  type RegisterNeedId,
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

function stepClass(active: boolean, done: boolean) {
  if (active) return 'rounded-full bg-foreground px-3 py-1 text-background'
  if (done) return 'rounded-full bg-muted px-3 py-1 text-foreground'
  return 'rounded-full border px-3 py-1 text-muted-foreground'
}

type OrgCopy = {
  section: string
  nameLabel: string
  placeholder: string
  trialNote: string
  pendingLabel: string
}

/** Confirm-step wording follows the chosen workspace (school ≠ company). */
function orgCopyFor(packId: PackId | null, familyId: PackFamilyId | null): OrgCopy {
  const byPack: Partial<Record<PackId, OrgCopy>> = {
    school: {
      section: 'Your school',
      nameLabel: 'School name',
      placeholder: 'e.g. Hodan Academy',
      trialNote:
        'Creating your school starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating school…',
    },
    university: {
      section: 'Your university',
      nameLabel: 'University name',
      placeholder: 'e.g. Hodan University',
      trialNote:
        'Creating your university starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating university…',
    },
    hospital_admin: {
      section: 'Your hospital',
      nameLabel: 'Hospital name',
      placeholder: 'e.g. Hodan Hospital',
      trialNote:
        'Creating your hospital starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating hospital…',
    },
    pharmacy: {
      section: 'Your pharmacy',
      nameLabel: 'Pharmacy name',
      placeholder: 'e.g. Hodan Pharmacy',
      trialNote:
        'Creating your pharmacy starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating pharmacy…',
    },
    restaurant: {
      section: 'Your restaurant',
      nameLabel: 'Restaurant name',
      placeholder: 'e.g. Hodan Cafe',
      trialNote:
        'Creating your restaurant starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating restaurant…',
    },
    hotel: {
      section: 'Your hotel',
      nameLabel: 'Hotel name',
      placeholder: 'e.g. Hodan Hotel',
      trialNote:
        'Creating your hotel starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating hotel…',
    },
    ngo: {
      section: 'Your organisation',
      nameLabel: 'Organisation name',
      placeholder: 'e.g. Hodan Foundation',
      trialNote:
        'Creating your organisation starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating organisation…',
    },
  }

  if (packId && byPack[packId]) return byPack[packId]!

  if (familyId === 'education') {
    return {
      section: 'Your school',
      nameLabel: 'School name',
      placeholder: 'e.g. Hodan Academy',
      trialNote:
        'Creating your school starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating school…',
    }
  }

  if (familyId === 'health') {
    return {
      section: 'Your organisation',
      nameLabel: 'Organisation name',
      placeholder: 'e.g. Hodan Clinic',
      trialNote:
        'Creating your organisation starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating organisation…',
    }
  }

  if (familyId === 'services' || familyId === 'everything') {
    return {
      section: 'Your organisation',
      nameLabel: 'Organisation name',
      placeholder: 'e.g. Hodan Group',
      trialNote:
        'Creating your organisation starts a 14-day free trial. You can sign in and open the books immediately.',
      pendingLabel: 'Creating organisation…',
    }
  }

  return {
    section: 'Your company',
    nameLabel: 'Company name',
    placeholder: 'e.g. Hodan Trading',
    trialNote:
      'Creating your company starts a 14-day free trial. You can sign in and open the books immediately.',
    pendingLabel: 'Creating company…',
  }
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const v = state.values ?? {}

  const [step, setStep] = useState(0)
  const [familyId, setFamilyId] = useState<PackFamilyId | null>(null)
  const [packId, setPackId] = useState<PackId | null>((v.packId as PackId) || null)
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => defaultOnboardingAnswers())
  const [needSelection, setNeedSelection] = useState<Partial<Record<RegisterNeedId, boolean>>>({})
  const [stepError, setStepError] = useState<string | null>(null)
  const [termCount, setTermCount] = useState<2 | 3>(2)
  const academicDefaults = useMemo(() => defaultAcademicCalendar(), [])
  const showAcademicYear = packNeedsAcademicYear(packId)

  const familyPacks = useMemo(
    () => (familyId ? packsInFamily(familyId) : []),
    [familyId],
  )

  const recommendation = useMemo(() => recommendPackFromAnswers(answers), [answers])

  const packNeeds = useMemo(() => (packId ? needsForPack(packId) : []), [packId])

  const preview = useMemo(
    () => (packId ? workspacePreview(packId) : null),
    [packId],
  )

  const orgCopy = useMemo(() => orgCopyFor(packId, familyId), [packId, familyId])

  function selectFamily(id: PackFamilyId) {
    setFamilyId(id)
    setPackId(null)
    setNeedSelection({})
    setAnswers((prev) => ({
      ...prev,
      sector: SECTOR_BY_FAMILY[id],
    }))
    setStepError(null)
  }

  function selectPack(id: PackId) {
    setPackId(id)
    setNeedSelection(defaultNeedsSelection(id))
    setStepError(null)
  }

  function needChecked(id: RegisterNeedId, locked?: boolean, defaultOn?: boolean): boolean {
    if (locked) return true
    if (needSelection[id] !== undefined) return Boolean(needSelection[id])
    return Boolean(defaultOn)
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
      {/* Needs must stay in the form on Confirm — step 2 UI unmounts. */}
      {packNeeds.map((need) => {
        const on = needChecked(need.id, need.locked, need.defaultOn)
        if (!on) return null
        return <input key={`persist_${need.id}`} type="hidden" name={`need_${need.id}`} value="true" />
      })}

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
                  onClick={() => selectPack(pack.id)}
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
            <p className="text-sm font-semibold text-foreground">What do you need?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Turn on the work areas that matter for{' '}
              {packId ? workspacePreview(packId)?.packLabel : 'your workspace'}. You can change apps
              later in Settings.
            </p>
          </div>
          <div className="grid max-h-[min(28rem,55vh)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {packNeeds.map((need) => {
              const checked = needChecked(need.id, need.locked, need.defaultOn)
              return (
                <label
                  key={need.id}
                  className={
                    need.locked
                      ? 'flex cursor-default items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 opacity-90'
                      : 'flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5'
                  }
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{need.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{need.hint}</span>
                    {need.locked ? (
                      <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Included in desk
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-input"
                    checked={checked}
                    disabled={need.locked}
                    onChange={(event) =>
                      setNeedSelection((prev) => ({
                        ...prev,
                        [need.id]: event.target.checked,
                      }))
                    }
                  />
                </label>
              )
            })}
          </div>
          {familyId && recommendation.packId !== packId && familyPacks.some((p) => p.id === recommendation.packId) ? (
            <p className="text-xs text-muted-foreground">
              Related workspace:{' '}
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => selectPack(recommendation.packId)}
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
              {packNeeds.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-foreground">Selected needs</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {packNeeds
                      .filter((need) => needChecked(need.id, need.locked, need.defaultOn))
                      .map((need) => need.label)
                      .join(' · ')}
                  </p>
                </div>
              ) : null}
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
              {orgCopy.section}
            </p>

            <Field
              name="organizationName"
              label={orgCopy.nameLabel}
              required
              error={state.fieldErrors?.organizationName}
            >
              <Input
                {...fieldProps('organizationName', state.fieldErrors?.organizationName)}
                defaultValue={v.organizationName ?? ''}
                placeholder={orgCopy.placeholder}
                autoFocus
                required
              />
            </Field>

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

            {showAcademicYear ? (
              <div className="space-y-4 rounded-md border border-border/80 bg-muted/20 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    School year
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Set Term 1, Term 2, and vacations. You can adjust dates later under Education →
                    Terms.
                  </p>
                </div>

                {state.fieldErrors?.academicYearLabel ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.academicYearLabel}</p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="academicYearLabel" label="School year label" required>
                    <Input
                      name="academicYearLabel"
                      defaultValue={
                        (v.academicYearLabel as string | undefined) ??
                        academicDefaults.academicYearLabel
                      }
                      placeholder="e.g. 2026"
                      required
                    />
                  </Field>
                  <Field name="termCount" label="How many terms?">
                    <select
                      name="termCount"
                      value={termCount}
                      onChange={(e) => setTermCount(Number(e.target.value) === 3 ? 3 : 2)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    >
                      <option value={2}>2 terms</option>
                      <option value={3}>3 terms</option>
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="term1StartsOn" label="Term 1 starts" required>
                    <Input
                      name="term1StartsOn"
                      type="date"
                      required
                      defaultValue={
                        (v.term1StartsOn as string | undefined) ?? academicDefaults.term1StartsOn
                      }
                    />
                  </Field>
                  <Field name="term1EndsOn" label="Term 1 ends" required>
                    <Input
                      name="term1EndsOn"
                      type="date"
                      required
                      defaultValue={
                        (v.term1EndsOn as string | undefined) ?? academicDefaults.term1EndsOn
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="midVacationStartsOn" label="Mid-year vacation starts">
                    <Input
                      name="midVacationStartsOn"
                      type="date"
                      defaultValue={
                        (v.midVacationStartsOn as string | undefined) ??
                        academicDefaults.midVacationStartsOn ??
                        ''
                      }
                    />
                  </Field>
                  <Field name="midVacationEndsOn" label="Mid-year vacation ends">
                    <Input
                      name="midVacationEndsOn"
                      type="date"
                      defaultValue={
                        (v.midVacationEndsOn as string | undefined) ??
                        academicDefaults.midVacationEndsOn ??
                        ''
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="term2StartsOn" label="Term 2 starts" required>
                    <Input
                      name="term2StartsOn"
                      type="date"
                      required
                      defaultValue={
                        (v.term2StartsOn as string | undefined) ?? academicDefaults.term2StartsOn
                      }
                    />
                  </Field>
                  <Field name="term2EndsOn" label="Term 2 ends" required>
                    <Input
                      name="term2EndsOn"
                      type="date"
                      required
                      defaultValue={
                        (v.term2EndsOn as string | undefined) ?? academicDefaults.term2EndsOn
                      }
                    />
                  </Field>
                </div>

                {termCount === 3 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="term3StartsOn" label="Term 3 starts" required>
                      <Input
                        name="term3StartsOn"
                        type="date"
                        required
                        defaultValue={
                          (v.term3StartsOn as string | undefined) ??
                          academicDefaults.term3StartsOn ??
                          ''
                        }
                      />
                    </Field>
                    <Field name="term3EndsOn" label="Term 3 ends" required>
                      <Input
                        name="term3EndsOn"
                        type="date"
                        required
                        defaultValue={
                          (v.term3EndsOn as string | undefined) ??
                          academicDefaults.term3EndsOn ??
                          ''
                        }
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="endVacationStartsOn" label="End-of-year vacation starts">
                    <Input
                      name="endVacationStartsOn"
                      type="date"
                      defaultValue={
                        (v.endVacationStartsOn as string | undefined) ??
                        academicDefaults.endVacationStartsOn ??
                        ''
                      }
                    />
                  </Field>
                  <Field name="endVacationEndsOn" label="End-of-year vacation ends">
                    <Input
                      name="endVacationEndsOn"
                      type="date"
                      defaultValue={
                        (v.endVacationEndsOn as string | undefined) ??
                        academicDefaults.endVacationEndsOn ??
                        ''
                      }
                    />
                  </Field>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Books year (ledger) follows Term 1 start — you do not set a separate fiscal calendar
                  here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
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
            )}
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

          <p className="text-xs text-muted-foreground">{orgCopy.trialNote}</p>
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
          <SubmitButton className="min-w-[10rem]" pendingLabel={orgCopy.pendingLabel}>
            Start free trial
          </SubmitButton>
        )}
      </div>
    </form>
  )
}
