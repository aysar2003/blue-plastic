'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTransition } from 'react'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { clearAllTrash, clearTrashEntry } from './actions'

export function ClearAllTrashButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() => {
        if (
          !window.confirm(
            'Clear all of Trash? Every item leaves this list and cannot be restored from here. Soft-deleted entries stay out of the company books.',
          )
        ) {
          return
        }
        startTransition(async () => {
          const result = await clearAllTrash({})
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(
            result.data.count === 0
              ? 'Trash was already empty.'
              : result.data.count === 1
                ? '1 item cleared from Trash.'
                : `${result.data.count} items cleared from Trash.`,
          )
          await queryClient.invalidateQueries({ queryKey: ['trash'] })
          router.refresh()
        })
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
      Clear Trash
    </Button>
  )
}

export function ClearTrashEntryButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Clear ${label} from Trash? It cannot be restored from here afterwards.`,
          )
        ) {
          return
        }
        startTransition(async () => {
          const result = await clearTrashEntry({ id })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success('Cleared from Trash.')
          router.push('/settings/activity')
          router.refresh()
        })
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
      Clear
    </Button>
  )
}
