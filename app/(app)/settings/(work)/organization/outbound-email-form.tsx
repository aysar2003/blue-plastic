'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { matchSmtpPreset, SMTP_PRESETS, type SmtpPresetId } from '@/lib/smtp-presets'
import { testOutboundEmailForm, updateOutboundEmailForm } from './actions'

export type OutboundEmailSettings = {
  configured: boolean
  host: string | null
  port: number | null
  secure: boolean
  user: string | null
  from: string | null
  hasPassword: boolean
}

export function OutboundEmailForm({
  settings,
  canEdit,
}: {
  settings: OutboundEmailSettings
  canEdit: boolean
}) {
  const router = useRouter()
  const [saveState, saveAction] = useActionState(updateOutboundEmailForm, idleState)
  const [testState, testAction] = useActionState(testOutboundEmailForm, idleState)

  const initialPreset = matchSmtpPreset(settings.host, settings.port)
  const [preset, setPreset] = useState<SmtpPresetId>(initialPreset)
  const [host, setHost] = useState(settings.host ?? '')
  const [port, setPort] = useState(String(settings.port ?? (initialPreset === 'gmail' ? 465 : 587)))
  const [secure, setSecure] = useState(settings.secure)
  const [user, setUser] = useState(settings.user ?? '')
  const [from, setFrom] = useState(settings.from ?? settings.user ?? '')

  const presetMeta = useMemo(
    () => SMTP_PRESETS.find((p) => p.id === preset) ?? SMTP_PRESETS[2]!,
    [preset],
  )

  useEffect(() => {
    if (saveState.status === 'success') router.refresh()
  }, [saveState.status, router])

  const applyPreset = (id: SmtpPresetId) => {
    setPreset(id)
    const next = SMTP_PRESETS.find((p) => p.id === id) ?? SMTP_PRESETS[2]!
    if (id !== 'custom') {
      setHost(next.host)
      setPort(String(next.port))
      setSecure(next.secure)
    }
  }

  const e = saveState.fieldErrors

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outgoing email</CardTitle>
        <CardDescription>
          Connect this company’s mailbox so invoices, bills, and statements can be sent from the Email
          button. Gmail (App Password) or your own domain SMTP both work. Each company uses its own
          connection.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {settings.configured ? (
            <>
              Connected as <span className="font-medium text-foreground">{settings.from ?? settings.user}</span>
              {settings.host ? (
                <>
                  {' '}
                  via <span className="font-medium text-foreground">{settings.host}</span>
                </>
              ) : null}
              .
            </>
          ) : (
            <>Not connected — Email still opens your mail app until you save SMTP here.</>
          )}
        </p>

        <form action={saveAction} className="space-y-4">
          <FormStatus state={saveState} />

          <Field name="preset" label="Provider" hint={presetMeta.hint}>
            <NativeSelect
              name="preset"
              value={preset}
              disabled={!canEdit}
              onChange={(event) => applyPreset(event.target.value as SmtpPresetId)}
            >
              {SMTP_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="host" label="SMTP host" required error={e?.host}>
              <Input
                {...fieldProps('host', e?.host)}
                value={host}
                onChange={(event) => {
                  setHost(event.target.value)
                  setPreset('custom')
                }}
                placeholder="smtp.gmail.com"
                disabled={!canEdit}
                required
              />
            </Field>
            <Field name="port" label="Port" required error={e?.port}>
              <Input
                {...fieldProps('port', e?.port)}
                type="number"
                value={port}
                onChange={(event) => {
                  setPort(event.target.value)
                  setPreset('custom')
                }}
                disabled={!canEdit}
                required
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="secure"
              value="true"
              checked={secure}
              onChange={(event) => {
                setSecure(event.target.checked)
                setPreset('custom')
              }}
              disabled={!canEdit}
              className="size-4 rounded border-input"
            />
            Use SSL/TLS (port 465). Turn off for STARTTLS on 587.
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="user" label="Username / mailbox" required error={e?.user}>
              <Input
                {...fieldProps('user', e?.user)}
                type="email"
                value={user}
                onChange={(event) => setUser(event.target.value)}
                placeholder="you@gmail.com"
                disabled={!canEdit}
                required
              />
            </Field>
            <Field name="from" label="From address" hint="Usually the same as the mailbox." error={e?.from}>
              <Input
                {...fieldProps('from', e?.from, true)}
                type="email"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                placeholder={user || 'invoices@company.com'}
                disabled={!canEdit}
              />
            </Field>
          </div>

          <Field
            name="password"
            label="Password / App Password"
            hint={
              settings.hasPassword
                ? 'Leave blank to keep the saved password. Gmail: use an App Password, not your login password.'
                : 'Gmail: Google Account → Security → App passwords.'
            }
            error={e?.password}
          >
            <Input
              {...fieldProps('password', e?.password, true)}
              type="password"
              autoComplete="new-password"
              placeholder={settings.hasPassword ? '••••••••' : undefined}
              disabled={!canEdit}
            />
          </Field>

          {canEdit ? (
            <CardFooter className="flex flex-wrap gap-2 px-0 pb-0">
              <SubmitButton pendingLabel="Saving…">Save connection</SubmitButton>
              {settings.configured || settings.hasPassword ? (
                <Button type="submit" name="clear" value="true" variant="outline">
                  Disconnect
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </form>

        {canEdit && settings.configured ? (
          <form action={testAction} className="space-y-3 border-t border-border/60 pt-4">
            <FormStatus state={testState} />
            <Field name="to" label="Send a test to" error={testState.fieldErrors?.to}>
              <Input
                {...fieldProps('to', testState.fieldErrors?.to)}
                type="email"
                defaultValue={settings.user ?? ''}
                required
              />
            </Field>
            <SubmitButton pendingLabel="Sending…">Send test email</SubmitButton>
          </form>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Need help with Gmail?{' '}
          <Link
            href="https://support.google.com/accounts/answer/185833"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Create an App Password
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
