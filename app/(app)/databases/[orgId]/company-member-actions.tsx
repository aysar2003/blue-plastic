'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRoundIcon, MoreHorizontalIcon } from 'lucide-react'
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
import {
  removeCompanyMember,
  resetCompanyMemberPasswordForm,
  setCompanyMemberConnect,
  setCompanyMemberStatus,
  updateCompanyMemberAccess,
} from './actions'

export function CompanyMemberActions({
  orgId,
  membershipId,
  userId,
  role,
  status,
  name,
  email,
  canConnect,
  isSelf,
  isSystemOwnerUser,
  canManage,
  isSystemOwnerViewer,
  roles,
}: {
  orgId: string
  membershipId: string
  userId: string
  role: string
  status: string
  name: string
  email: string
  canConnect: boolean
  isSelf: boolean
  isSystemOwnerUser: boolean
  canManage: boolean
  isSystemOwnerViewer: boolean
  roles: string[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>
  }

  if (!canManage) return null

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) => {
    start(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.error?.message ?? 'That did not work.')
      }
    })
  }

  const canStatus = role !== 'OWNER' && !isSystemOwnerUser
  // System owner may remove anyone except themselves — including company OWNER.
  const canRemove =
    isSystemOwnerViewer || (role !== 'OWNER' && !isSystemOwnerUser)
  const canConnectToggle = isSystemOwnerViewer && role === 'ADMIN'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRoundIcon /> Reset password
          </DropdownMenuItem>
          {canConnectToggle ? (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () =>
                    setCompanyMemberConnect({
                      orgId,
                      membershipId,
                      canConnect: !canConnect,
                    }),
                  canConnect
                    ? `${name} can no longer Connect.`
                    : `${name} may Connect to other companies.`,
                )
              }
            >
              {canConnect ? 'Revoke Connect' : 'Allow Connect'}
            </DropdownMenuItem>
          ) : null}
          {canStatus ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {status !== 'ACTIVE' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setCompanyMemberStatus({ orgId, membershipId, status: 'ACTIVE' }),
                      `${name} is active.`,
                    )
                  }
                >
                  Activate
                </DropdownMenuItem>
              ) : null}
              {status !== 'INVITED' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setCompanyMemberStatus({ orgId, membershipId, status: 'INVITED' }),
                      `${name} is pending.`,
                    )
                  }
                >
                  Set pending
                </DropdownMenuItem>
              ) : null}
              {status !== 'SUSPENDED' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setCompanyMemberStatus({ orgId, membershipId, status: 'SUSPENDED' }),
                      `${name} suspended.`,
                    )
                  }
                >
                  Suspend
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {role !== 'OWNER' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              {roles.map((next) => (
                <DropdownMenuItem
                  key={next}
                  disabled={next === role}
                  onSelect={() =>
                    run(
                      () =>
                        updateCompanyMemberAccess({
                          orgId,
                          membershipId,
                          role: next,
                          permissionsOverride: [],
                        }),
                      `${name} is now ${ROLE_LABELS[next as keyof typeof ROLE_LABELS] ?? next}.`,
                    )
                  }
                >
                  {ROLE_LABELS[next as keyof typeof ROLE_LABELS] ?? next}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  const warn =
                    role === 'OWNER'
                      ? `Remove OWNER ${name} from this company? They lose access to these books.`
                      : `Remove ${name} from this company?`
                  if (!window.confirm(warn)) return
                  run(
                    () => removeCompanyMember({ orgId, membershipId }),
                    `${name} removed from this company.`,
                  )
                }}
              >
                Remove from company
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResetWorkPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset work password"
        description={`Set a new temporary password for ${name} (${email}). The old password is never shown — only this new one, once.`}
        hiddenFields={{ orgId, membershipId }}
        formAction={resetCompanyMemberPasswordForm}
      />
    </>
  )
}
