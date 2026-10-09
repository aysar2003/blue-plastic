'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'

import { openPosSession } from '@/app/(app)/pos/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ODOO } from '@/lib/odoo-brand'
import { CASHIER_PIN_MAX, CASHIER_PIN_MESSAGE, isCashierPin } from '@/lib/pos-pin'

export function SessionOpenForm({
  registerId,
  registerName,
  currency,
  hasPin = false,
  beforeSubmit,
}: {
  registerId: string
  registerName: string
  currency: string
  hasPin?: boolean
  beforeSubmit?: () => Promise<unknown>
}) {
  const router = useRouter()
  const [openingCash, setOpeningCash] = useState('0.00')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (hasPin && !isCashierPin(pin.trim())) {
      setError(pin.trim() === '' ? 'Enter the PIN.' : CASHIER_PIN_MESSAGE)
      return
    }
    startTransition(async () => {
      await beforeSubmit?.()
      const result = await openPosSession({
        registerId,
        openingCash,
        ...(hasPin ? { pin } : {}),
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push(`/pos/${registerId}`)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold text-foreground">Open session · {registerName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the cash in the drawer before the first sale ({currency}).
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="opening-cash">Opening cash</Label>
          <Input
            id="opening-cash"
            value={openingCash}
            onChange={(event) => setOpeningCash(event.target.value)}
            inputMode="decimal"
          />
        </div>
        {hasPin ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="cashier-pin">Cashier PIN</Label>
            <Input
              id="cashier-pin"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              minLength={4}
              maxLength={CASHIER_PIN_MAX}
              pattern="[A-Za-z0-9]{4,64}"
              title="Use at least 4 letters or numbers."
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="mt-4 text-white hover:opacity-95"
          style={{ background: ODOO.purple }}
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Open register
        </Button>
      </CardContent>
    </Card>
  )
}
