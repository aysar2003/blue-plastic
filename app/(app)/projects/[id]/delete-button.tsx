'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { deleteProject } from '@/app/(app)/projects/actions'
import { Button } from '@/components/ui/button'

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Delete ${name}? Tasks go with it. Sales and purchases on this job must be unlinked first.`,
          )
        ) {
          return
        }
        start(async () => {
          const result = await deleteProject({ id })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success('Project deleted.')
          router.push('/projects')
          router.refresh()
        })
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
      Delete
    </Button>
  )
}
