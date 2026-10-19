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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteSystemUser, resetSystemUserPasswordForm, setSystemUserStatus } from './actions'

export function SystemUserActions({
  userId,
  name,
  email,
  isSelf,
  isSystemOwner,
  ownsCompany,
  hasStaffMembership,
  status,
}: {
  userId: string
  name: string
  email: string
  isSelf: boolean
  isSystemOwner: boolean
  ownsCompany: boolean
  hasStaffMembership: boolean
  status: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>
  }

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

  const canStatus = hasStaffMembership && !isSystemOwner
  const canDelete = !isSystemOwner && !ownsCompany

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRoundIcon /> Reset password
          </DropdownMenuItem>
          {canStatus ? (
            <>
              <DropdownMenuSeparator />
              {status !== 'INVITED' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => setSystemUserStatus({ userId, status: 'INVITED' }),
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
                      () => setSystemUserStatus({ userId, status: 'ACTIVE' }),
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
                      () => setSystemUserStatus({ userId, status: 'SUSPENDED' }),
                      `${name} suspended.`,
                    )
                  }
                >
                  Suspend
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (
                    !window.confirm(
                      `Delete ${name} (${email})? They will no longer be able to sign in.`,
                    )
                  ) {
                    return
                  }
                  run(() => deleteSystemUser({ userId }), `${name} deleted.`)
                }}
              >
                Delete user
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
        hiddenFields={{ userId }}
        formAction={resetSystemUserPasswordForm}
      />
    </>
  )
}
