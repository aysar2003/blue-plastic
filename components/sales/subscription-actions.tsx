'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import {
  createDueSubscriptions,
  createSubscriptionInstance,
  deleteSubscription,
  setSubscriptionActive,
} from '@/app/(app)/sales/subscriptions/actions'
import { Button } from '@/components/ui/button'

export function CreateDueSubscriptionsButton({ dueCount }: { dueCount: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending || dueCount === 0}
      onClick={() => {
        start(async () => {
          const result = await createDueSubscriptions(undefined)
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          const n = result.data.created.length
          toast.success(n === 0 ? 'Nothing due.' : `Created ${n} invoice${n === 1 ? '' : 's'}.`)
          router.refresh()
        })
      }}
    >
      {pending ? 'Creating…' : dueCount > 0 ? `Create due (${dueCount})` : 'Nothing due'}
    </Button>
  )
}

export function SubscriptionRowActions({
  id,
  isActive,
}: {
  id: string
  isActive: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !isActive}
        onClick={() => {
          start(async () => {
            const result = await createSubscriptionInstance({ id })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(`Invoice ${result.data.number} created.`)
            router.refresh()
          })
        }}
      >
        Create now
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await setSubscriptionActive({ id, isActive: !isActive })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(isActive ? 'Paused.' : 'Resumed.')
            router.refresh()
          })
        }}
      >
        {isActive ? 'Pause' : 'Resume'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          start(async () => {
            if (!window.confirm('Delete this schedule?')) return
            const result = await deleteSubscription({ id })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success('Deleted.')
            router.refresh()
          })
        }}
      >
        Delete
      </Button>
    </div>
  )
}
