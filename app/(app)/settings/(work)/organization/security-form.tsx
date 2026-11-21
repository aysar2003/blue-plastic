'use client'

import { useActionState, useMemo, useState } from 'react'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  DEFAULT_IDLE_LOCK_SECONDS,
  DEFAULT_SESSION_MAX_HOURS,
  IDLE_LOCK_PRESETS,
  SESSION_LOGOUT_PRESETS,
  clampIdleLockSeconds,
  clampSessionMaxHours,
} from '@/lib/desk-security'
import type { EnforceTwoFactorMode } from '@/lib/enforce-two-factor'
import { updateSecuritySettingsForm } from './actions'

const CUSTOM = '__custom__'

function idlePresetValue(seconds: number): string {
  return IDLE_LOCK_PRESETS.some((row) => row.seconds === seconds)
    ? String(seconds)
    : CUSTOM
}

function sessionPresetValue(hours: number): string {
  return SESSION_LOGOUT_PRESETS.some((row) => row.hours === hours)
    ? String(hours)
    : CUSTOM
}

export function SecurityForm({
  idleLockSeconds,
  sessionMaxHours,
  enforceTwoFactor = 'OFF',
  canEdit,
}: {
  idleLockSeconds: number
  sessionMaxHours: number
  enforceTwoFactor?: EnforceTwoFactorMode
  canEdit: boolean
}) {
  const [state, formAction] = useActionState(updateSecuritySettingsForm, idleState)
  const e = state.fieldErrors

  const initialIdle = clampIdleLockSeconds(idleLockSeconds || DEFAULT_IDLE_LOCK_SECONDS)
  const initialSession = clampSessionMaxHours(sessionMaxHours || DEFAULT_SESSION_MAX_HOURS)

  const [idleChoice, setIdleChoice] = useState(idlePresetValue(initialIdle))
  const [idleCustom, setIdleCustom] = useState(String(initialIdle))
  const [sessionChoice, setSessionChoice] = useState(sessionPresetValue(initialSession))
  const [sessionCustom, setSessionCustom] = useState(String(initialSession))
  const [enforce, setEnforce] = useState<EnforceTwoFactorMode>(enforceTwoFactor)

  const idleValue = useMemo(() => {
    if (idleChoice === CUSTOM) return clampIdleLockSeconds(Number(idleCustom))
    return clampIdleLockSeconds(Number(idleChoice))
  }, [idleChoice, idleCustom])

  const sessionValue = useMemo(() => {
    if (sessionChoice === CUSTOM) return clampSessionMaxHours(Number(sessionCustom))
    return clampSessionMaxHours(Number(sessionChoice))
  }, [sessionChoice, sessionCustom])

  return (
    <form action={formAction}>
      <input type="hidden" name="idleLockSeconds" value={idleValue} />
      <input type="hidden" name="sessionMaxHours" value={sessionValue} />
      <input type="hidden" name="enforceTwoFactor" value={enforce} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desk lock &amp; session</CardTitle>
          <CardDescription>
            Idle lock covers the screen after no mouse or keyboard activity. Session logout signs
            everyone out after a fixed time from login — same settings on computer and phone.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FormStatus state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Field name="idleLockPreset" label="Lock screen after" required error={e?.idleLockSeconds}>
                <NativeSelect
                  {...fieldProps('idleLockPreset', e?.idleLockSeconds)}
                  value={idleChoice}
                  disabled={!canEdit}
                  onChange={(event) => setIdleChoice(event.target.value)}
                >
                  {IDLE_LOCK_PRESETS.map((row) => (
                    <option key={row.seconds} value={row.seconds}>
                      {row.label}
                    </option>
                  ))}
                  <option value={CUSTOM}>Custom…</option>
                </NativeSelect>
              </Field>
              {idleChoice === CUSTOM ? (
                <Field name="idleLockCustom" label="Custom idle (seconds)" required>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={86400}
                    step={1}
                    value={idleCustom}
                    disabled={!canEdit}
                    onChange={(event) => setIdleCustom(event.target.value)}
                  />
                </Field>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Minimum 30 seconds. Default is 15 minutes.
              </p>
            </div>

            <div className="space-y-3">
              <Field
                name="sessionMaxPreset"
                label="Sign out after"
                required
                error={e?.sessionMaxHours}
              >
                <NativeSelect
                  {...fieldProps('sessionMaxPreset', e?.sessionMaxHours)}
                  value={sessionChoice}
                  disabled={!canEdit}
                  onChange={(event) => setSessionChoice(event.target.value)}
                >
                  {SESSION_LOGOUT_PRESETS.map((row) => (
                    <option key={row.hours} value={row.hours}>
                      {row.label}
                    </option>
                  ))}
                  <option value={CUSTOM}>Custom…</option>
                </NativeSelect>
              </Field>
              {sessionChoice === CUSTOM ? (
                <Field name="sessionMaxCustom" label="Custom session (hours)" required>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={24}
                    step={1}
                    value={sessionCustom}
                    disabled={!canEdit}
                    onChange={(event) => setSessionCustom(event.target.value)}
                  />
                </Field>
              ) : null}
              <p className="text-xs text-muted-foreground">
                From the moment of login. Maximum 24 hours. Default is 10 hours.
              </p>
            </div>
          </div>

          <Field
            name="enforceTwoFactorSelect"
            label="Enforce two-factor authentication"
            error={e?.enforceTwoFactor}
          >
            <NativeSelect
              {...fieldProps('enforceTwoFactorSelect', e?.enforceTwoFactor)}
              value={enforce}
              disabled={!canEdit}
              onChange={(event) => setEnforce(event.target.value as EnforceTwoFactorMode)}
            >
              <option value="OFF">Off (default)</option>
              <option value="STAFF">Employees only</option>
              <option value="ALL">All users (including portal)</option>
            </NativeSelect>
          </Field>
          <p className="text-xs text-muted-foreground">
            Like Odoo: when on, users must set up an authenticator app before they can use the desk.
            Email codes alone do not satisfy this setting.
          </p>
        </CardContent>

        {canEdit ? (
          <CardFooter className="justify-end">
            <SubmitButton pendingLabel="Saving…">Save security</SubmitButton>
          </CardFooter>
        ) : null}
      </Card>
    </form>
  )
}
