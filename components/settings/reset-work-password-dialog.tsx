'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { idleState, type FormState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { generateTemporaryPassword } from '@/lib/temporary-password'

/**
 * Set a new temporary work password. The previous password is never shown —
 * only the new value appears once after save so staff can hand it over.
 */
export function ResetWorkPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  hiddenFields,
  formAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Hidden inputs (membershipId or userId). */
  hiddenFields: Record<string, string>
  formAction: (prev: FormState, formData: FormData) => Promise<FormState>
}) {
  if (!open) return null

  // Remount on each open so the temporary password is fresh without an effect.
  const sessionKey = Object.values(hiddenFields).join('|')

  return (
    <ResetWorkPasswordDialogInner
      key={sessionKey}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      hiddenFields={hiddenFields}
      formAction={formAction}
    />
  )
}

function ResetWorkPasswordDialogInner({
  onOpenChange,
  title,
  description,
  hiddenFields,
  formAction,
}: {
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  hiddenFields: Record<string, string>
  formAction: (prev: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, action] = useActionState(formAction, idleState)
  const [temporaryPassword, setTemporaryPassword] = useState(() => generateTemporaryPassword())
  const shownRef = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && state.temporaryPassword && !shownRef.current) {
      shownRef.current = true
      toast.success(state.message ?? 'Password updated.')
    }
    if (state.status !== 'success') shownRef.current = false
  }, [state])

  const shownOnce = state.status === 'success' && state.temporaryPassword

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>

        {shownOnce ? (
          <div className="space-y-4">
            <FormStatus state={state} />
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                New temporary password — show once
              </p>
              <p className="mt-1 break-all font-mono text-sm text-foreground">{state.temporaryPassword}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Copy it now and give it to the person. It cannot be shown again — you can only set a
                new one.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.temporaryPassword!)
                  toast.success('Password copied.')
                }}
              >
                Copy
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <FormStatus state={state} />
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Field
              name="temporaryPassword"
              label="New temporary password"
              required
              error={state.fieldErrors?.temporaryPassword}
            >
              <div className="flex gap-2">
                <Input
                  {...fieldProps('temporaryPassword', state.fieldErrors?.temporaryPassword, true)}
                  type="text"
                  name="temporaryPassword"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  autoComplete="off"
                  required
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTemporaryPassword(generateTemporaryPassword())}
                >
                  New
                </Button>
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton>Save password</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
