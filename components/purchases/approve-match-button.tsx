'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { approveMatchVariance } from '@/app/(app)/purchases/actions'
import { Button } from '@/components/ui/button'

export function ApproveMatchButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await approveMatchVariance({ id })
          if (result.ok) {
            toast.success('Match variance approved — bill posted.')
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }}
    >
      {pending ? 'Posting…' : 'Approve variance & post'}
    </Button>
  )
}
