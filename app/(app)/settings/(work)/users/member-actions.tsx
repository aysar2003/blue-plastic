'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ResetWorkPasswordDialog } from '@/components/settings/reset-work-password-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS } from '@/lib/roles'
import { EditMemberAccessDialog } from './edit-member-access-dialog'
import {
  removeMember,
  resetMemberPasswordForm,
  setMemberStatus,
  updateMemberAccess,
} from './actions'

export function MemberActions({
  membershipId,
  role,
  status,
  name,
  email,
  permissionsOverride,
  roles,
  roleTemplates,
  canUpdate,
  canRemove,
}: {
  membershipId: string
  role: string
  status: string
  name: string
  email: string
  permissionsOverride: string[]
  roles: string[]
  roleTemplates: Record<string, string[]>
  canUpdate: boolean
  canRemove: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) => {
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.error?.message ?? 'That did not work.')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={isPending} aria-label={`Actions for ${name}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canUpdate ? (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                Edit access…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                Reset password…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Quick role</DropdownMenuLabel>
              {roles.map((r) => (
                <DropdownMenuItem
                  key={r}
                  disabled={r === role && permissionsOverride.length === 0}
                  onSelect={() =>
                    run(
                      () => updateMemberAccess({ membershipId, role: r, permissionsOverride: [] }),
                      `${name} is now ${ROLE_LABELS[r as keyof typeof ROLE_LABELS]}.`,
                    )
                  }
                >
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                  {r === role && permissionsOverride.length === 0 ? (
                    <span className="ml-auto text-xs text-muted-foreground">current</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {status !== 'INVITED' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setMemberStatus({ membershipId, status: 'INVITED' }),
                      `${name} is pending.`,
                    )
                  }
                >
                  Set pending
                </DropdownMenuItem>
              ) : null}
              {status !== 'ACTIVE' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setMemberStatus({ membershipId, status: 'ACTIVE' }),
                      `${name} is active.`,
                    )
                  }
                >
                  Activate
                </DropdownMenuItem>
              ) : null}
              {status !== 'SUSPENDED' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setMemberStatus({ membershipId, status: 'SUSPENDED' }),
                      `${name} suspended.`,
                    )
                  }
                >
                  Suspend access
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}

          {canRemove ? (
            <>
              {canUpdate ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (!window.confirm(`Remove ${name} from this company?`)) return
                  run(() => removeMember({ membershipId }), `${name} removed.`)
                }}
              >
                Remove from organisation
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canUpdate ? (
        <EditMemberAccessDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          membershipId={membershipId}
          name={name}
          initialRole={role}
          initialPermissions={permissionsOverride}
          roles={roles}
          roleTemplates={roleTemplates}
        />
      ) : null}

      {canUpdate ? (
        <ResetWorkPasswordDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset work password"
          description={`Set a new temporary password for ${name} (${email}). The old password is never shown — only this new one, once.`}
          hiddenFields={{ membershipId }}
          formAction={resetMemberPasswordForm}
        />
      ) : null}
    </>
  )
}
