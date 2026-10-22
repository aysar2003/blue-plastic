'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { generateTemporaryPassword } from '@/lib/temporary-password'
import { inviteCompanyUserForm } from './actions'

export function InviteCompanyUserDialog({
  orgId,
  companyName,
  roles,
}: {
  orgId: string
  companyName: string
  roles: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(roles[0] ?? 'VIEWER')
  const [temporaryPassword] = useState(() => generateTemporaryPassword())
  const [state, formAction] = useActionState(inviteCompanyUserForm, idleState)
  const closeRef = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !closeRef.current) {
      closeRef.current = true
      toast.success(state.message ?? 'Member added.')
      setOpen(false)
      router.refresh()
    }
    if (state.status !== 'success') closeRef.current = false
  }, [state, router])

  const roleOptions = useMemo(() => roles, [roles])

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon /> Add user
      </Button>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) setOpen(false)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user · {companyName}</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Invite someone into this company only. Give them a temporary password — the old one is
          never shown.
        </p>
        <form action={formAction} className="space-y-4">
          <FormStatus state={state} />
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="permissionsOverride" value="[]" />
          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input {...fieldProps('name', state.fieldErrors?.name)} required />
          </Field>
          <Field name="email" label="Email" required error={state.fieldErrors?.email}>
            <Input
              {...fieldProps('email', state.fieldErrors?.email)}
              type="email"
              required
              autoComplete="off"
            />
          </Field>
          <Field name="role" label="Role" required error={state.fieldErrors?.role}>
            <NativeSelect
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {roleOptions.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS] ?? ''}
            </p>
          </Field>
          <Field
            name="temporaryPassword"
            label="Temporary password"
            required
            error={state.fieldErrors?.temporaryPassword}
          >
            <Input
              {...fieldProps('temporaryPassword', state.fieldErrors?.temporaryPassword)}
              defaultValue={temporaryPassword}
              required
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Add to company</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
