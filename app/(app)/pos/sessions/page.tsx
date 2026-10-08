import type { Metadata } from 'next'
import Link from 'next/link'

import { ODOO } from '@/lib/odoo-brand'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS Sessions' }

export default async function PosSessionsPage() {
  const ctx = await requireOrgContext('pos:read')
  const sessions = await posService.listSessions(ctx)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Sessions</h1>
      <p className="mt-1 text-sm text-white/55">
        Cash-control periods — opening float, orders, and closing count.
      </p>

      <div
        className="mt-6 overflow-hidden rounded-xl border border-white/10"
        style={{ background: ODOO.surface }}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Register</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Opening</th>
              <th className="px-4 py-3 font-medium">Closing</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-t border-white/8 text-white/90">
                <td className="px-4 py-2.5 text-white/60">{session.dateLabel}</td>
                <td className="px-4 py-2.5">
                  {session.status === 'OPEN' ? (
                    <Link href={`/pos/${session.registerId}`} className="text-[#8fd4d7] hover:underline">
                      {session.registerName}
                    </Link>
                  ) : (
                    session.registerName
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      background: session.status === 'OPEN' ? ODOO.teal : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {session.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular">{session.openingCash}</td>
                <td className="px-4 py-2.5 tabular text-white/70">{session.closingCash ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular">{session.orderCount}</td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/45">
                  No sessions yet. Open a register from the dashboard.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
