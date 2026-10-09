'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { clearPosRegisterUnlock, unlockPosRegister } from '@/app/(app)/pos/actions'
import { CashierPinPrompt } from '@/components/pos/cashier-pin-prompt'
import { PageHeader } from '@/components/data/page-header'
import { SessionOpenForm } from '@/components/pos/session-open-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ODOO } from '@/lib/odoo-brand'
import { cn } from '@/lib/utils'

export type DashboardRegister = {
  id: string
  name: string
  storeName: string | null
  hasPin: boolean
  session: {
    id: string
    dateLabel: string
    openingCash: string
  } | null
}

export function PosDashboard({
  registers,
  currency,
  canManage,
  orgInitial,
  initialOpenRegisterId = null,
}: {
  registers: DashboardRegister[]
  currency: string
  canManage: boolean
  orgInitial: string
  initialOpenRegisterId?: string | null
}) {
  const router = useRouter()
  const [openingId, setOpeningId] = useState<string | null>(initialOpenRegisterId)
  const [continuingId, setContinuingId] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // The list drops any previous unlock. Wait for that before storing a new one,
  // so a slow clear cannot wipe the PIN the cashier just entered.
  const clearUnlock = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    clearUnlock.current = clearPosRegisterUnlock(undefined)
  }, [])

  const continuing = registers.find((row) => row.id === continuingId) ?? null

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        description="Open a session, then continue selling — same flow as Odoo."
        actions={
          canManage ? (
            <Link href="/pos/settings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Configuration
            </Link>
          ) : undefined
        }
      />

      {continuing ? (
        <div className="mb-6 max-w-md">
          <CashierPinPrompt
            registerName={continuing.name}
            pending={pending}
            error={pinError}
            submitLabel="Continue selling"
            onCancel={() => {
              setContinuingId(null)
              setPinError(null)
            }}
            onSubmit={(pin) => {
              setPinError(null)
              startTransition(async () => {
                await clearUnlock.current
                const result = await unlockPosRegister({ registerId: continuing.id, pin })
                if (!result.ok) {
                  setPinError(result.error.message)
                  return
                }
                router.push(`/pos/${continuing.id}`)
                router.refresh()
              })
            }}
          />
        </div>
      ) : null}

      {openingId ? (
        <div className="mb-6 max-w-md">
          <SessionOpenForm
            registerId={openingId}
            registerName={registers.find((row) => row.id === openingId)?.name ?? 'Register'}
            currency={currency}
            hasPin={registers.find((row) => row.id === openingId)?.hasPin ?? false}
            beforeSubmit={() => clearUnlock.current}
          />
          <button
            type="button"
            className="mt-3 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setOpeningId(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {registers.map((register) => (
          <Card key={register.id} className="relative">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold uppercase tracking-wide text-foreground">
                    {register.name}
                  </h2>
                  {register.storeName ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{register.storeName}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                {register.session ? (
                  <>
                    {register.hasPin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpeningId(null)
                          setPinError(null)
                          setContinuingId(register.id)
                        }}
                        className={cn(
                          buttonVariants({ size: 'sm' }),
                          'text-white shadow-sm hover:opacity-95',
                        )}
                        style={{ background: ODOO.purple }}
                      >
                        Continue Selling
                      </button>
                    ) : (
                      <Link
                        href={`/pos/${register.id}`}
                        className={cn(
                          buttonVariants({ size: 'sm' }),
                          'text-white shadow-sm hover:opacity-95',
                        )}
                        style={{ background: ODOO.purple }}
                      >
                        Continue Selling
                      </Link>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <p>Date: {register.session.dateLabel}</p>
                      <p>Opening: {register.session.openingCash}</p>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setContinuingId(null)
                      setPinError(null)
                      setOpeningId(register.id)
                    }}
                    className={cn(
                      buttonVariants({ size: 'sm' }),
                      'text-white shadow-sm hover:opacity-95',
                    )}
                    style={{ background: ODOO.purple }}
                  >
                    Open Register
                  </button>
                )}
              </div>

              <div
                className="mt-5 inline-flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: ODOO.danger }}
              >
                {orgInitial}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {registers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            No active registers.{' '}
            {canManage ? (
              <Link href="/pos/settings" className="font-medium text-primary underline">
                Create one in Configuration
              </Link>
            ) : (
              'Ask an admin to configure POS.'
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
