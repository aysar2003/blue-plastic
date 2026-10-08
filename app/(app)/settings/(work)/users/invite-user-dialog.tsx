'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { PermissionMatrix } from '@/components/settings/permission-matrix'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/roles'
import { inviteUserForm } from './actions'

type AccessMode = 'preset' | 'apps'

export function InviteUserDialog({
  roles,
  roleTemplates,
}: {
  roles: string[]
  /** Permission keys for each preset role — seeds the apps matrix. */
  roleTemplates: Record<string, string[]>
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AccessMode>('apps')
  const [role, setRole] = useState(roles[0] ?? 'VIEWER')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(roleTemplates[roles[0] ?? 'VIEWER'] ?? []),
  )
  const [state, formAction] = useActionState(inviteUserForm, idleState)
  const closeRef = useRef(false)

  const permissionsJson = useMemo(
    () => JSON.stringify(mode === 'apps' ? [...selected] : []),
    [mode, selected],
  )

  useEffect(() => {
    if (state.status === 'success' && !closeRef.current) {
      closeRef.current = true
      toast.success(state.message ?? 'Member added.')
      setOpen(false)
    }
    if (state.status !== 'success') closeRef.current = false
  }, [state])

  function applyTemplate(nextRole: string) {
    setRole(nextRole)
    setSelected(new Set(roleTemplates[nextRole] ?? []))
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon /> Add member
      </Button>
    )
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) setOpen(false) }}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Give them a temporary password, then choose which Apps they may open — the same apps
          on the home screen.
        </p>

        <form action={formAction} className="space-y-4">
          <FormStatus state={state} />
          <input type="hidden" name="permissionsOverride" value={permissionsJson} />
          <input type="hidden" name="role" value={mode === 'apps' ? 'CUSTOM' : role} />

          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input {...fieldProps('name', state.fieldErrors?.name)} autoFocus required />
          </Field>

          <Field name="email" label="Email" required error={state.fieldErrors?.email}>
            <Input {...fieldProps('email', state.fieldErrors?.email)} type="email" required />
          </Field>

          <Field
            name="temporaryPassword"
            label="Temporary password"
            hint="At least 6 characters. Letters, numbers, and symbols are fine."
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Access</legend>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'apps' ? 'default' : 'outline'}
                onClick={() => {
                  if (mode !== 'apps') {
                    setSelected(new Set(roleTemplates[role] ?? []))
                  }
                  setMode('apps')
                }}
              >
                Apps & permissions
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'preset' ? 'default' : 'outline'}
                onClick={() => setMode('preset')}
              >
                Ready-made role
              </Button>
            </div>
          </fieldset>

          {mode === 'preset' ? (
            <Field
              name="roleDisplay"
              label="Role"
              hint={ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
              required
              error={state.fieldErrors?.role}
            >
              <NativeSelect
                value={role}
                onChange={(e) => applyTemplate(e.target.value)}
                aria-label="Role"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <div className="space-y-3">
              <Field
                name="template"
                label="Start from a role template"
                hint="Optional — loads that role’s apps so you can tick or untick."
              >
                <NativeSelect
                  value={role}
                  onChange={(e) => applyTemplate(e.target.value)}
                  aria-label="Start from template"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <p className="text-xs text-muted-foreground">
                {selected.size} permission{selected.size === 1 ? '' : 's'} selected
              </p>
              {state.fieldErrors?.permissionsOverride ? (
                <p className="text-sm text-destructive">{state.fieldErrors.permissionsOverride}</p>
              ) : null}
              <PermissionMatrix selected={selected} onChange={setSelected} />
            </div>
          )}

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
