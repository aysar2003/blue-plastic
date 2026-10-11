'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { setMemberConnect } from './actions'

/** System owner grants Connect to an admin. Staff never see this. */
export function ConnectToggle({
  membershipId,
  enabled,
}: {
  membershipId: string
  enabled: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant={enabled ? 'default' : 'outline'}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await setMemberConnect({ membershipId, canConnect: !enabled })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(enabled ? 'Connect removed.' : 'This admin can connect to their companies.')
          router.refresh()
        })
      }}
    >
      {enabled ? 'Connect on' : 'Allow connect'}
    </Button>
  )
}
