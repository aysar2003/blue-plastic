'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArchiveRestoreIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { restoreTrashEntry } from './actions'

export function RestoreTrashButton({
  id,
  label,
  disabledReason,
}: {
  id: string
  label: string
  disabledReason?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (disabledReason) {
    return (
      <Button type="button" variant="outline" size="sm" disabled title={disabledReason}>
        <ArchiveRestoreIcon /> Restore
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Restore ${label} into the company books?`)) return
        startTransition(async () => {
          const result = await restoreTrashEntry({ id })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(`${result.data.number} restored.`)
          router.push(result.data.href)
          router.refresh()
        })
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <ArchiveRestoreIcon />}
      Restore
    </Button>
  )
}
