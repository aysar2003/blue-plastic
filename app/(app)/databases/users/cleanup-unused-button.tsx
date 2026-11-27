'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { deleteUnusedSystemUsers } from './actions'

export function CleanupUnusedButton({ count }: { count: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (count <= 0) return null

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      className="rounded-xl"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Delete ${count} unused login${count === 1 ? '' : 's'} with no company? This cannot be undone.`,
          )
        ) {
          return
        }
        start(async () => {
          const result = await deleteUnusedSystemUsers({})
          if (!result.ok) {
            toast.error(result.error?.message ?? 'Cleanup failed.')
            return
          }
          const { deleted, skipped } = result.data
          if (deleted.length > 0) {
            toast.success(
              deleted.length === 1
                ? `Deleted ${deleted[0]!.name}.`
                : `Deleted ${deleted.length} unused logins.`,
            )
          }
          if (skipped.length > 0) {
            toast.message(
              `${skipped.length} could not be deleted (history still references them).`,
            )
          }
          if (deleted.length === 0 && skipped.length === 0) {
            toast.message('No unused logins to delete.')
          }
          router.refresh()
        })
      }}
    >
      <Trash2Icon className="size-3.5" />
      {pending ? 'Cleaning…' : `Delete unused (${count})`}
    </Button>
  )
}
