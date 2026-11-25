'use client'

import { buttonVariants } from '@/components/ui/button'

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
      Print
    </button>
  )
}