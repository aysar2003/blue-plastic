'use client'

import { PanelRightOpenIcon } from 'lucide-react'

import { useOptionalContactDetailPanel } from '@/components/contacts/contact-split'

/** Appears in the name list when Customer / Vendor information is hidden. */
export function ContactDetailReopen() {
  const detail = useOptionalContactDetailPanel()
  if (!detail || detail.open) return null

  return (
    <button
      type="button"
      onClick={detail.show}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-sm hover:bg-accent"
      aria-expanded={false}
      aria-label="Show information"
    >
      Show information
      <PanelRightOpenIcon className="size-4 text-muted-foreground" />
    </button>
  )
}
