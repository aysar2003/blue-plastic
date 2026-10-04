'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

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
import { removeMember, setMemberStatus, updateMemberRole } from './actions'

export function MemberActions({
  membershipId,
  role,
  status,
  name,
  roles,
  canUpdate,
  canRemove,
}: {
  membershipId: string
  role: string
  status: string
  name: string
  roles: string[]
  canUpdate: boolean
  canRemove: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={isPending} aria-label={`Actions for ${name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canUpdate ? (
          <>
            <DropdownMenuLabel>Change role</DropdownMenuLabel>
            {roles.map((r) => (
              <DropdownMenuItem
                key={r}
                disabled={r === role}
                onSelect={() =>
                  run(
                    () => updateMemberRole({ membershipId, role: r }),
                    `${name} is now ${ROLE_LABELS[r as keyof typeof ROLE_LABELS]}.`,
                  )
                }
              >
                {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                {r === role ? <span className="ml-auto text-xs text-muted-foreground">current</span> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () =>
                    setMemberStatus({
                      membershipId,
                      status: status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                    }),
                  status === 'ACTIVE' ? `${name} suspended.` : `${name} restored.`,
                )
              }
            >
              {status === 'ACTIVE' ? 'Suspend access' : 'Restore access'}
            </DropdownMenuItem>
          </>
        ) : null}

        {canRemove ? (
          <>
            {canUpdate ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => run(() => removeMember({ membershipId }), `${name} removed.`)}
            >
              Remove from organisation
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
