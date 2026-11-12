'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateHrSettings } from './actions'

const WEEKDAY_LABELS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

type Settings = {
  hoursPerDay: string
  workDaysPerWeek: number
  overtimeAfterHoursPerDay: string
  overtimeMultiplier: string
  overtimeRules?: { afterHours: string; multiplier: string }[]
  workWeekdays?: number[]
  timezoneNote: string | null
}

function tiersToText(tiers: { afterHours: string; multiplier: string }[] | undefined) {
  if (!tiers?.length) return '12:2'
  return tiers.map((row) => `${strip(row.afterHours)}:${strip(row.multiplier)}`).join('\n')
}

function textToTiers(text: string) {
  return text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [after, mult] = line.split(':').map((part) => part.trim())
      return { afterHours: after || '0', multiplier: mult || '1' }
    })
    .filter((row) => Number(row.afterHours) > 0 && Number(row.multiplier) > 0)
}

export function HrSettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [hoursPerDay, setHoursPerDay] = useState(strip(settings.hoursPerDay))
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(String(settings.workDaysPerWeek))
  const [otAfter, setOtAfter] = useState(strip(settings.overtimeAfterHoursPerDay))
  const [otMult, setOtMult] = useState(strip(settings.overtimeMultiplier))
  const [otExtra, setOtExtra] = useState(tiersToText(settings.overtimeRules))
  const [weekdays, setWeekdays] = useState<number[]>(
    settings.workWeekdays?.length ? settings.workWeekdays : [1, 2, 3, 4, 5, 6],
  )
  const [timezoneNote, setTimezoneNote] = useState(settings.timezoneNote ?? '')

  function toggleDay(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  function save() {
    startBusy(async () => {
      const result = await updateHrSettings({
        hoursPerDay,
        workDaysPerWeek: Number(workDaysPerWeek),
        overtimeAfterHoursPerDay: otAfter,
        overtimeMultiplier: otMult,
        overtimeRules: textToTiers(otExtra),
        workWeekdays: weekdays,
        timezoneNote: timezoneNote.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save')
        return
      }
      toast.success('HR settings saved')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-xl gap-4">
      <p className="text-sm text-muted-foreground">
        Payroll uses these rules for hourly OT bands, unpaid leave, and counting workdays in a period.
      </p>
      <Field label="Standard hours / day">
        <Input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Work days / week (fallback)">
        <Input
          type="number"
          min={1}
          max={7}
          value={workDaysPerWeek}
          onChange={(e) => setWorkDaysPerWeek(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <div className="space-y-1.5">
        <Label>Work weekdays</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((day) => (
            <label key={day.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={weekdays.includes(day.value)}
                disabled={!canEdit}
                onChange={() => toggleDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>
      <Field label="First OT after (hours / day)">
        <Input value={otAfter} onChange={(e) => setOtAfter(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="First OT multiplier">
        <Input value={otMult} onChange={(e) => setOtMult(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Extra OT bands (afterHours:multiplier)">
        <textarea
          className="min-h-[4rem] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
          value={otExtra}
          onChange={(e) => setOtExtra(e.target.value)}
          placeholder={'12:2'}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Timezone note (optional)">
        <Input
          value={timezoneNote}
          onChange={(e) => setTimezoneNote(e.target.value)}
          placeholder="Africa/Mogadishu"
          disabled={!canEdit}
        />
      </Field>
      {canEdit ? (
        <div>
          <Button type="button" disabled={busy || weekdays.length === 0} onClick={save}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function strip(value: string) {
  return value.replace(/\.?0+$/, '') || '0'
}
