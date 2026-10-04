'use client'

import { useState } from 'react'
import { PencilIcon } from 'lucide-react'

import { ContactDialog, type ContactSide, type ContactValues, type Option } from '@/components/master-data/contact-dialog'
import { Button } from '@/components/ui/button'
import type { AccountPickerOption } from '@/lib/account-options'

export function EditContact({
  side,
  contact,
  terms,
  expenseAccounts,
  today,
  currency,
}: {
  side: ContactSide
  contact: ContactValues
  terms: Option[]
  expenseAccounts?: AccountPickerOption[]
  today: string
  currency: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setOpen(true)}>
        <PencilIcon />
      </Button>
      {open ? (
        <ContactDialog
          side={side}
          mode="edit"
          contact={contact}
          terms={terms}
          expenseAccounts={expenseAccounts}
          today={today}
          currency={currency}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
