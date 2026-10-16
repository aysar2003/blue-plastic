'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  createDueRecurring,
  createRecurringInstance,
  deleteRecurring,
  setRecurringActive,
} from '@/app/(app)/banking/recurring/actions'
import { Button } from '@/components/ui/button'

export function CreateDueButton({ dueCount }: { dueCount: number }) {
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
          const result = await createDueRecurring(undefined)
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          const n = result.data.created.length
          const skipped = result.data.skipped.length
          if (n === 0) {
            toast.message(skipped ? 'Nothing created — check permissions.' : 'Nothing due.')
          } else {
            toast.success(
              skipped
                ? `Created ${n}. ${skipped} skipped.`
                : `Created ${n} transaction${n === 1 ? '' : 's'}.`,
            )
          }
          router.refresh()
        })
      }}
    >
      {pending ? 'Creating…' : dueCount > 0 ? `Create due (${dueCount})` : 'Nothing due'}
    </Button>
  )
}

export function RecurringRowActions({
  id,
  name,
  isActive,
  due,
  canAct,
}: {
  id: string
  name: string
  isActive: boolean
  due: boolean
  canAct: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!canAct) return null

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !isActive}
        onClick={() => {
          start(async () => {
            const result = await createRecurringInstance({ id })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(`${result.data.number} created from ${name}.`)
            router.refresh()
          })
        }}
      >
        {due ? 'Create now' : 'Create'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await setRecurringActive({ id, isActive: !isActive })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(isActive ? 'Paused.' : 'Active again.')
            router.refresh()
          })
        }}
      >
        {isActive ? 'Pause' : 'Resume'}
      </Button>
      {confirmDelete ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await deleteRecurring({ id })
              if (!result.ok) {
                toast.error(result.error.message)
                setConfirmDelete(false)
                return
              }
              toast.success('Deleted.')
              router.push('/banking/recurring')
              router.refresh()
            })
          }}
        >
          Confirm delete
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      )}
    </div>
  )
}
