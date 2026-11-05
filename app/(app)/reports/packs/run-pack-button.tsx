'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runPackNow } from './actions'

export function RunPackButton({ packId }: { packId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await runPackNow({ id: packId })
          if (result.ok) {
            toast.success('Pack built.')
            router.refresh()
          } else {
            toast.error(result.error?.message ?? 'Could not build the pack.')
          }
        })
      }
    >
      {pending ? 'Building…' : 'Run now'}
    </Button>
  )
}
