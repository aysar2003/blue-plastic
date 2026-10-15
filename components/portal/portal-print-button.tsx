'use client'

import { PortalPrintInkButton } from '@/components/print/print-ink-menu'

/** Browser print for portal statement papers — Color or Black & White. */
export function PortalPrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return <PortalPrintInkButton label={label} />
}
