'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  refreshPortalInvite,
  removePortalUser,
  resetPortalPasswordForm,
  setPortalUserStatus,
} from '@/app/(app)/customers/portal-users/actions'
import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

export function PortalUserActions({
  membershipId,
  status,
  email,
}: {
  membershipId: string
  status: string
  email: string
}) {
  const [pending, startTransition] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)
  const [state, formAction] = useActionState(resetPortalPasswordForm, idleState)
  const closeRef = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !closeRef.current) {
      closeRef.current = true
      toast.success(state.message ?? 'Password updated.')
      setResetOpen(false)
    }
    if (state.status !== 'success') closeRef.current = false
  }, [state])

  function run(label: string, work: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      const result = await work()
      if (result.ok) toast.success(label)
      else toast.error(result.error?.message ?? 'Something went wrong.')
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" disabled={pending} aria-label={`Actions for ${email}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === 'INVITED' ? (
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await refreshPortalInvite({ membershipId })
                  if (result.ok && result.data.inviteUrl) {
                    await navigator.clipboard.writeText(result.data.inviteUrl)
                    toast.success('Invite link copied.')
                  } else if (!result.ok) {
                    toast.error(result.error.message)
                  }
                })
              }
            >
              Copy invite link
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setResetOpen(true)}>Reset password</DropdownMenuItem>
          )}
          {status === 'ACTIVE' ? (
            <DropdownMenuItem
              onSelect={() =>
                run('Portal login suspended.', () =>
                  setPortalUserStatus({ membershipId, status: 'SUSPENDED' }),
                )
              }
            >
              Suspend
            </DropdownMenuItem>
          ) : status === 'SUSPENDED' ? (
            <DropdownMenuItem
              onSelect={() =>
                run('Portal login reactivated.', () =>
                  setPortalUserStatus({ membershipId, status: 'ACTIVE' }),
                )
              }
            >
              Reactivate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              run('Portal login removed.', () => removePortalUser({ membershipId }))
            }
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {resetOpen ? (
        <Dialog open onOpenChange={(next) => { if (!next) setResetOpen(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
            </DialogHeader>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Set a new temporary password for {email}.
            </p>
            <form action={formAction} className="space-y-4">
              <FormStatus state={state} />
              <input type="hidden" name="membershipId" value={membershipId} />
              <Field
                name="temporaryPassword"
                label="Temporary password"
                required
                error={state.fieldErrors?.temporaryPassword}
              >
                <Input
                  {...fieldProps('temporaryPassword', state.fieldErrors?.temporaryPassword, true)}
                  type="text"
                  autoComplete="off"
                  required
                  autoFocus
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>Save password</SubmitButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
