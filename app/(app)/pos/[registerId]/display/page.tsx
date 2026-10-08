'use client'

import { useEffect, useState } from 'react'

import { ODOO } from '@/lib/odoo-brand'

type DisplayState = {
  orgName: string
  customerName: string | null
  total: string
  lines: { name: string; quantity: number; amount: string }[]
}

/**
 * Second-screen customer display — listens to the till via BroadcastChannel.
 */
export default function PosCustomerDisplayPage() {
  const [state, setState] = useState<DisplayState>({
    orgName: 'Point of Sale',
    customerName: null,
    total: '',
    lines: [],
  })

  useEffect(() => {
    const channel = new BroadcastChannel('pos-customer-display')
    channel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        setState(event.data as DisplayState)
      }
    }
    return () => channel.close()
  }, [])

  const empty = state.lines.length === 0

  return (
    <div className="flex min-h-screen" style={{ background: '#f7f7f8', color: '#1f1f23' }}>
      <aside
        className="flex w-[40%] flex-col items-center justify-between border-r border-black/5 p-8"
        style={{ background: '#eceef0' }}
      >
        <div className="mt-16 text-center">
          <div
            className="mx-auto flex size-28 items-center justify-center rounded-2xl text-3xl font-bold text-white"
            style={{ background: ODOO.purple }}
          >
            {(state.orgName.trim()[0] ?? 'P').toUpperCase()}
          </div>
          <p className="mt-4 text-lg font-semibold">{state.orgName}</p>
        </div>
        <p className="rounded-full bg-[#2c2c2c] px-4 py-1.5 text-xs text-white/80">Powered by Blue Plastic</p>
      </aside>
      <main className="flex flex-1 flex-col p-8">
        {empty ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-4xl font-light text-black/35">Welcome</p>
          </div>
        ) : (
          <>
            {state.customerName ? (
              <p className="mb-4 text-sm text-black/50">Customer · {state.customerName}</p>
            ) : null}
            <ul className="flex-1 space-y-3 overflow-y-auto">
              {state.lines.map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex justify-between gap-4 text-lg">
                  <span>
                    {line.quantity} × {line.name}
                  </span>
                  <span className="tabular font-medium">{line.amount}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-black/10 pt-4 text-right">
              <p className="text-sm uppercase tracking-wide text-black/45">Total</p>
              <p className="text-4xl font-semibold tabular" style={{ color: ODOO.purple }}>
                {state.total}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
