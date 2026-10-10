'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { unlockPosRegister } from '@/app/(app)/pos/actions'
import { CashierPinPrompt } from '@/components/pos/cashier-pin-prompt'
import { ODOO } from '@/lib/odoo-brand'

/** Shown on the till itself when this browser has not entered the cashier PIN. */
export function RegisterPinGate({
  registerId,
  registerName,
}: {
  registerId: string
  registerName: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div
      className="on-dark flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4"
      style={{ background: ODOO.ink }}
    >
      <div className="w-full max-w-md">
        <CashierPinPrompt
          registerName={registerName}
          pending={pending}
          error={error}
          submitLabel="Continue selling"
          onSubmit={(pin) => {
            setError(null)
            startTransition(async () => {
              const result = await unlockPosRegister({ registerId, pin })
              if (!result.ok) {
                setError(result.error.message)
                return
              }
              router.refresh()
            })
          }}
        />
        <Link href="/pos" className="mt-4 inline-block text-sm text-white/50 hover:text-white">
          Back to registers
        </Link>
      </div>
    </div>
  )
}
