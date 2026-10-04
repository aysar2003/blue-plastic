'use client'

import { useState } from 'react'

import { formatMoney } from '@/lib/money'

export type OpenLine = {
  account: string
  description: string | null
  debit: string
  credit: string
}

/** The row opens its lines while the pointer is on it. */
export function HoverEntry({
  stripe,
  currency,
  lines,
  children,
}: {
  stripe: boolean
  currency: string
  lines: OpenLine[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const row = stripe ? 'bg-[#c5dff3]' : 'bg-white'

  return (
    <tbody onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <tr className={`${row} border-b ${open ? 'bg-[#d5dde6]' : ''}`}>{children}</tr>
      {open ? (
        <tr className="border-b bg-[#e4ebf2]">
          <td colSpan={7} className="px-3 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 pr-3 font-semibold">Account</th>
                  <th className="py-1 pr-3 font-semibold">Description</th>
                  <th className="py-1 pr-3 text-right font-semibold">Debit</th>
                  <th className="py-1 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.account}-${index}`} className={index % 2 === 1 ? 'bg-[#c5dff3]' : 'bg-white'}>
                    <td className="py-1 pr-3">{line.account}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{line.description ?? '—'}</td>
                    <td className="numeric py-1 pr-3 tabular">{line.debit === '0.00' ? '—' : formatMoney(line.debit, currency)}</td>
                    <td className="numeric py-1 tabular">{line.credit === '0.00' ? '—' : formatMoney(line.credit, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </tbody>
  )
}
