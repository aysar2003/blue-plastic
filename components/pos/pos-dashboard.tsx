'use client'

import Link from 'next/link'
import { useState } from 'react'

import { SessionOpenForm } from '@/components/pos/session-open-form'
import { ODOO } from '@/lib/odoo-brand'

export type DashboardRegister = {
  id: string
  name: string
  storeName: string | null
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
  const [openingId, setOpeningId] = useState<string | null>(initialOpenRegisterId)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Point of Sale</h1>
          <p className="mt-1 text-sm text-white/55">
            Open a session, then continue selling — same flow as Odoo.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/pos/settings"
            className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Configuration
          </Link>
        ) : null}
      </div>

      {openingId ? (
        <div className="mb-6 max-w-md">
          <SessionOpenForm
            registerId={openingId}
            registerName={registers.find((row) => row.id === openingId)?.name ?? 'Register'}
            currency={currency}
          />
          <button
            type="button"
            className="mt-3 text-sm text-white/50 hover:text-white"
            onClick={() => setOpeningId(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {registers.map((register) => (
          <article
            key={register.id}
            className="relative rounded-xl border border-white/10 p-5 shadow-lg"
            style={{ background: ODOO.surface }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold uppercase tracking-wide text-white">
                  {register.name}
                </h2>
                {register.storeName ? (
                  <p className="mt-0.5 text-xs text-white/45">{register.storeName}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              {register.session ? (
                <>
                  <Link
                    href={`/pos/${register.id}`}
                    className="inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    style={{ background: ODOO.purple }}
                  >
                    Continue Selling
                  </Link>
                  <div className="text-sm text-white/55">
                    <p>Date: {register.session.dateLabel}</p>
                    <p>Opening: {register.session.openingCash}</p>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpeningId(register.id)}
                  className="inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
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
          </article>
        ))}
      </div>

      {registers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 px-5 py-10 text-center text-sm text-white/50">
          No active registers.{' '}
          {canManage ? (
            <Link href="/pos/settings" className="text-[#8fd4d7] underline">
              Create one in Configuration
            </Link>
          ) : (
            'Ask an admin to configure POS.'
          )}
        </div>
      ) : null}
    </div>
  )
}
