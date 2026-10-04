'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/roles'
import { inviteUserForm } from './actions'

export function InviteUserDialog({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(roles[0] ?? 'VIEWER')
  const [state, formAction] = useActionState(inviteUserForm, idleState)
  const closeRef = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !closeRef.current) {
      closeRef.current = true
      toast.success(state.message ?? 'Member added.')
      setOpen(false)
    }
    if (state.status !== 'success') closeRef.current = false
  }, [state])

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon /> Add member
      </Button>
    )
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) setOpen(false) }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          They can sign in immediately with the password you set here. Ask them to change it.
        </p>

        <form action={formAction} className="space-y-4">
          <FormStatus state={state} />

          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input {...fieldProps('name', state.fieldErrors?.name)} autoFocus required />
          </Field>

          <Field name="email" label="Email" required error={state.fieldErrors?.email}>
            <Input {...fieldProps('email', state.fieldErrors?.email)} type="email" required />
          </Field>

          <Field
            name="role"
            label="Role"
            hint={ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
            required
            error={state.fieldErrors?.role}
          >
            <NativeSelect
              {...fieldProps('role', state.fieldErrors?.role, true)}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            name="temporaryPassword"
            label="Temporary password"
            hint="At least 12 characters."
            required
            error={state.fieldErrors?.temporaryPassword}
          >
            <Input
              {...fieldProps('temporaryPassword', state.fieldErrors?.temporaryPassword, true)}
              type="text"
              autoComplete="off"
              required
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
