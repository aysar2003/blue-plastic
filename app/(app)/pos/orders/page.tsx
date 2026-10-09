import type { Metadata } from 'next'
import Link from 'next/link'

import { ODOO } from '@/lib/odoo-brand'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS Orders' }

export default async function PosOrdersPage() {
  const ctx = await requireOrgContext('pos:read')
  const orders = await posService.listPosOrders(ctx)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Orders</h1>
      <p className="mt-1 text-sm text-white/55">Sales rung up at the till, newest first.</p>

      <div
        className="mt-6 overflow-hidden rounded-xl border border-white/10"
        style={{ background: ODOO.surface }}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Register</th>
              <th className="px-4 py-3 font-medium">Payments</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">
                <span className="sr-only">Print</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.orders.map((order) => (
              <tr key={order.id} className="border-t border-white/8 text-white/90">
                <td className="px-4 py-2.5 text-white/60">{order.dateLabel}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/sales/sales-receipts/${order.documentId}`}
                    className="font-medium text-[#8fd4d7] hover:underline"
                  >
                    {order.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{order.registerName}</td>
                <td className="px-4 py-2.5 text-white/65">{order.payments || '—'}</td>
                <td className="px-4 py-2.5 text-white/65">{order.changeLabel ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular font-medium">{order.total}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/pos-receipt/${order.documentId}`}
                    className="text-[#8fd4d7] hover:underline"
                    aria-label={`Print receipt ${order.number}`}
                  >
                    Print
                  </Link>
                </td>
              </tr>
            ))}
            {orders.orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/45">
                  No POS orders yet. Open a session and continue selling.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {orders.totals.length > 0 ? (
        <div
          className="mt-4 overflow-hidden rounded-xl border border-white/10"
          style={{ background: ODOO.surface }}
        >
          <h2 className="px-4 py-3 text-sm font-semibold text-white">Received by account</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium text-right">Tendered</th>
                <th className="px-4 py-2 font-medium text-right">Change returned</th>
                <th className="px-4 py-2 font-medium text-right">Net received</th>
              </tr>
            </thead>
            <tbody>
              {orders.totals.map((total) => (
                <tr key={total.name} className="border-t border-white/8 text-white/90">
                  <td className="px-4 py-2">{total.name}</td>
                  <td className="px-4 py-2 text-right tabular">{total.tendered}</td>
                  <td className="px-4 py-2 text-right tabular">{total.change}</td>
                  <td className="px-4 py-2 text-right tabular font-medium">{total.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
