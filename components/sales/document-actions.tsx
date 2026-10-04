'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2Icon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { convertEstimate } from '@/app/(app)/sales/actions'

export function ConvertEstimateButton({
  id,
  number,
  today,
  variant = 'default',
  label = 'Create invoice',
}: {
  id: string
  number: string
  today: string
  variant?: 'default' | 'outline' | 'ghost'
  /** Short label for tight list rows. */
  label?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={isPending}
      title={`Create an invoice with the same items and prices as ${number}`}
      onClick={() =>
        startTransition(async () => {
          const result = await convertEstimate({ id, date: today })
          if (result.ok) {
            toast.success(`Invoice ${result.data.number} created from ${number}.`)
            router.push(`/sales/invoices/${result.data.id}`)
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <FileCheck2Icon />}
      {label}
    </Button>
  )
}
