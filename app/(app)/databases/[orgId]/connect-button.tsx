'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { CheckIcon, Loader2Icon, LogInIcon } from 'lucide-react'
import { toast } from 'sonner'

import { openCompany } from '@/app/(app)/databases/actions'
import { Button } from '@/components/ui/button'

export function ConnectCompanyButton({
  orgId,
  isCurrent,
  blocked,
}: {
  orgId: string
  isCurrent: boolean
  blocked?: boolean
}) {
  const router = useRouter()
  const { update } = useSession()
  const [busy, setBusy] = useState(false)

  if (isCurrent) {
    return (
      <Button type="button" size="sm" variant="secondary" disabled>
        <CheckIcon />
        Current company
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={busy || blocked}
      onClick={() => {
        setBusy(true)
        void (async () => {
          try {
            const result = await openCompany({ orgId })
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            await update({ orgId })
            toast.success('Company opened.')
            router.push('/dashboard')
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not open company.')
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
      Connect
    </Button>
  )
}
