'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/** Open that company's own profit and loss. The system owner connects first. */
export function OpenCompanyReport({ orgId, current }: { orgId: string; current: boolean }) {
  const router = useRouter()
  const { update } = useSession()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      type="button"
      size="sm"
      variant={current ? 'default' : 'outline'}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          if (!current) await update({ orgId })
          router.push('/reports/profit-loss')
          router.refresh()
        } catch {
          toast.error('Could not open that company.')
          setBusy(false)
        }
      }}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : null}
      Open P&L
    </Button>
  )
}
