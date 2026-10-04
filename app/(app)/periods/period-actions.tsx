'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2Icon, LockIcon, UnlockIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { setPeriodStatus } from './actions'

/** Opens a month on the period list. A closed month is reopened first, so its data can be changed. */
export function OpenMonthButton({
  href,
  periodId,
  status,
  label,
  canReopen,
}: {
  href: string
  periodId: string
  status: 'OPEN' | 'CLOSED' | 'LOCKED'
  label: string
  canReopen: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (status === 'CLOSED' && canReopen) {
    return (
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setPeriodStatus({ periodId, status: 'OPEN' })
            if (result.ok) {
              toast.success(`${label} opened.`)
              router.push(href)
            } else {
              toast.error(result.error.message)
            }
          })
        }
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : null}
        Open
      </Button>
    )
  }

  return (
    <Link href={href} className={buttonVariants({ size: 'sm' })}>
      Open
    </Link>
  )
}

export function PeriodToggle({
  periodId,
  status,
  label,
  canClose,
  canReopen,
  openLabel = 'Reopen',
}: {
  periodId: string
  status: 'OPEN' | 'CLOSED' | 'LOCKED'
  label: string
  canClose: boolean
  canReopen: boolean
  /** What the button says when a closed month is opened again. */
  openLabel?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (status === 'LOCKED') {
    return <span className="text-xs text-muted-foreground">locked by year-end</span>
  }

  const closing = status === 'OPEN'
  if (closing && !canClose) return null
  if (!closing && !canReopen) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPeriodStatus({
            periodId,
            status: closing ? 'CLOSED' : 'OPEN',
          })
          if (result.ok) {
            toast.success(closing ? `${label} closed.` : `${label} reopened.`)
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : closing ? <LockIcon /> : <UnlockIcon />}
      {closing ? 'Close' : openLabel}
    </Button>
  )
}
