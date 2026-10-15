'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { invitePortalUserForm } from '@/app/(app)/customers/portal-users/actions'
import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { generateTemporaryPassword } from '@/lib/temporary-password'

type InviteMode = 'password' | 'link'

export function InvitePortalUserDialog({
  customers,
  defaultCustomerId,
}: {
  customers: { id: string; label: string; hint?: string }[]
  defaultCustomerId?: string
}) {
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [inviteMode, setInviteMode] = useState<InviteMode>('password')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [state, formAction] = useActionState(invitePortalUserForm, idleState)
  const notified = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !notified.current) {
      notified.current = true
      toast.success(state.message ?? 'Portal invite ready.')
    }
    if (state.status !== 'success') notified.current = false
  }, [state])

  function openDialog() {
    setCustomerId(defaultCustomerId ?? '')
    setInviteMode('password')
    setTemporaryPassword(generateTemporaryPassword())
    setOpen(true)
  }

  if (!open) {
    return (
      <Button size="sm" onClick={openDialog} disabled={customers.length === 0}>
        <UserPlusIcon /> Invite portal user
      </Button>
    )
  }

  const passwordSuccess =
    state.status === 'success' &&
    state.portalLoginUrl &&
    state.portalEmail &&
    state.temporaryPassword

  const linkSuccess = state.status === 'success' && state.inviteUrl && state.portalEmail

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) setOpen(false)
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Invite portal user</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Give them a login with a temporary password, or send an invite link so they choose their
          own. Either way they only see that customer&apos;s invoices and balance — view only.
        </p>

        {passwordSuccess ? (
          <div className="space-y-3">
            <CredentialRow
              label="Email"
              value={state.portalEmail!}
              onCopy={() => toast.success('Email copied.')}
            />
            <CredentialRow
              label="Password"
              value={state.temporaryPassword!}
              onCopy={() => toast.success('Password copied.')}
            />
            <CredentialRow
              label="Portal login link"
              value={state.portalLoginUrl!}
              mono
              onCopy={() => toast.success('Login link copied.')}
            />
            <div className="flex justify-end pt-1">
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : linkSuccess ? (
          <div className="space-y-3">
            <CredentialRow
              label="Email"
              value={state.portalEmail!}
              onCopy={() => toast.success('Email copied.')}
            />
            <CredentialRow
              label="Invite link"
              value={state.inviteUrl!}
              mono
              onCopy={() => toast.success('Invite link copied.')}
            />
            <p className="text-xs text-muted-foreground">
              They open the link, set a password, then sign in on the branded portal login page.
            </p>
            <div className="flex justify-end pt-1">
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <FormStatus state={state} />
            <input type="hidden" name="inviteMode" value={inviteMode} />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How they get in</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted/40">
                <input
                  type="radio"
                  name="inviteModeChoice"
                  className="mt-0.5"
                  checked={inviteMode === 'password'}
                  onChange={() => {
                    setInviteMode('password')
                    if (!temporaryPassword) setTemporaryPassword(generateTemporaryPassword())
                  }}
                />
                <span>
                  <span className="font-medium">Set a password for them</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    You share email, password, and the portal login link.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-muted/40">
                <input
                  type="radio"
                  name="inviteModeChoice"
                  className="mt-0.5"
                  checked={inviteMode === 'link'}
                  onChange={() => setInviteMode('link')}
                />
                <span>
                  <span className="font-medium">Send invite link</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    They open the link and choose their own password.
                  </span>
                </span>
              </label>
            </fieldset>

            <Field name="customerId" label="Customer" required error={state.fieldErrors?.customerId}>
              <EntityPicker
                id="customerId"
                name="customerId"
                kind="customer"
                options={customers}
                value={customerId || null}
                onChange={(next) => setCustomerId(next ?? '')}
                placeholder="Search or add a customer"
                required
                error={state.fieldErrors?.customerId}
              />
            </Field>

            <Field name="name" label="Name" required error={state.fieldErrors?.name}>
              <Input {...fieldProps('name', state.fieldErrors?.name)} autoFocus required />
            </Field>

            <Field name="email" label="Email" required error={state.fieldErrors?.email}>
              <Input {...fieldProps('email', state.fieldErrors?.email)} type="email" required />
            </Field>

            {inviteMode === 'password' ? (
              <Field
                name="temporaryPassword"
                label="Temporary password"
                hint="At least 6 characters. Letters, numbers, and symbols are fine."
                required
                error={state.fieldErrors?.temporaryPassword}
              >
                <div className="flex gap-2">
                  <Input
                    name="temporaryPassword"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    type="text"
                    autoComplete="off"
                    required
                    aria-invalid={Boolean(state.fieldErrors?.temporaryPassword)}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTemporaryPassword(generateTemporaryPassword())}
                  >
                    Generate
                  </Button>
                </div>
              </Field>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>
                {inviteMode === 'password' ? 'Create portal login' : 'Create invite link'}
              </SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CredentialRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  onCopy: () => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} className={mono ? 'font-mono text-xs' : 'font-mono text-sm'} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(value)
            onCopy()
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  )
}
