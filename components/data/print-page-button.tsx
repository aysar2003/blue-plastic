'use client'

import { PrinterIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PrintPageButton() {
  return (
    <Button type="button" variant="outline" size="icon" title="Print" onClick={() => window.print()}>
      <PrinterIcon />
    </Button>
  )
}
