'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateHrSettings } from './actions'

type Settings = {
  hoursPerDay: string
  workDaysPerWeek: number
  overtimeAfterHoursPerDay: string
  overtimeMultiplier: string
  timezoneNote: string | null
}

export function HrSettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [hoursPerDay, setHoursPerDay] = useState(strip(settings.hoursPerDay))
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(String(settings.workDaysPerWeek))
  const [otAfter, setOtAfter] = useState(strip(settings.overtimeAfterHoursPerDay))
  const [otMult, setOtMult] = useState(strip(settings.overtimeMultiplier))
  const [timezoneNote, setTimezoneNote] = useState(settings.timezoneNote ?? '')

  function save() {
    startBusy(async () => {
      const result = await updateHrSettings({
        hoursPerDay,
        workDaysPerWeek: Number(workDaysPerWeek),
        overtimeAfterHoursPerDay: otAfter,
        overtimeMultiplier: otMult,
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
        Rules used when payroll builds payslips for hourly staff, and when unpaid leave is converted to
        hours. Monthly/daily wages keep their own formulas.
      </p>
      <Field label="Standard hours / day">
        <Input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Work days / week">
        <Input
          type="number"
          min={1}
          max={7}
          value={workDaysPerWeek}
          onChange={(e) => setWorkDaysPerWeek(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Overtime after (hours / day)">
        <Input value={otAfter} onChange={(e) => setOtAfter(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Overtime multiplier">
        <Input value={otMult} onChange={(e) => setOtMult(e.target.value)} disabled={!canEdit} />
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
          <Button type="button" disabled={busy} onClick={save}>
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
