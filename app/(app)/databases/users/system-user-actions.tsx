'use client'

import { useState } from 'react'
import { KeyRoundIcon } from 'lucide-react'

import { ResetWorkPasswordDialog } from '@/components/settings/reset-work-password-dialog'
import { Button } from '@/components/ui/button'
import { resetSystemUserPasswordForm } from './actions'

export function SystemUserActions({
  userId,
  name,
  email,
  isSelf,
}: {
  userId: string
  name: string
  email: string
  isSelf: boolean
}) {
  const [resetOpen, setResetOpen] = useState(false)

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
        <KeyRoundIcon /> Reset password
      </Button>
      <ResetWorkPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset work password"
        description={`Set a new temporary password for ${name} (${email}). The old password is never shown — only this new one, once.`}
        hiddenFields={{ userId }}
        formAction={resetSystemUserPasswordForm}
      />
    </>
  )
}
