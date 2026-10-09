import Link from 'next/link'

import { ODOO } from '@/lib/odoo-brand'
import { DATE_PRESETS, listHref } from '@/lib/list-filters'
import { posOrderPresetParams, type PosOrderReportQuery } from '@/lib/pos-order-report'
import { cn } from '@/lib/utils'

export type PosOrdersReportOrder = {
  id: string
  dateLabel: string
  registerName: string
  documentId: string
  number: string
  payments: string
  total: string
}

export type PosOrdersReportProps = {
  orders: PosOrdersReportOrder[]
  summary: {
    orderCount: number
    total: string
    wallets: { methodId: string; name: string; total: string }[]
  }
  registers: { id: string; name: string; isActive: boolean }[]
  methods: { id: string; name: string; isActive: boolean }[]
  query: PosOrderReportQuery
  truncated: boolean
  limit: number
}

const controlClass =
  'mt-1 h-10 w-full rounded-md border border-white/15 bg-[#161618] px-2.5 text-sm text-white outline-none scheme-dark focus:border-[#017e84]'

export function PosOrdersReport({
  orders,
  summary,
  registers,
  methods,
  query,
  truncated,
  limit,
}: PosOrdersReportProps) {
  const filtered = query.preset !== '' || Boolean(query.registerId || query.paymentMethodId)
  const recentOnly = !query.from && !query.to && !query.registerId && !query.paymentMethodId

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Orders</h1>
      <p className="mt-1 text-sm text-white/55">Sales rung up at the till, newest first.</p>

      <form
        action="/pos/orders"
        method="get"
        aria-label="Filter orders"
        className="mt-5 rounded-xl border border-white/10 p-4"
        style={{ background: ODOO.surface }}
      >
        <nav aria-label="Date presets" className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map((option) => {
            const on = query.preset === option.value
            return (
              <Link
                key={option.label}
                href={listHref('/pos/orders', posOrderPresetParams(query, option.value))}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-medium',
                  on
                    ? 'text-white'
                    : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white',
                )}
                style={on ? { background: ODOO.teal } : undefined}
              >
                {option.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
            From
            <input
              type="date"
              name="from"
              defaultValue={query.from ?? ''}
              className={controlClass}
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
            To
            <input type="date" name="to" defaultValue={query.to ?? ''} className={controlClass} />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Register
            <select name="register" defaultValue={query.registerId ?? ''} className={controlClass}>
              <option value="">All registers</option>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.name}
                  {register.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Wallet
            <select name="method" defaultValue={query.paymentMethodId ?? ''} className={controlClass}>
              <option value="">All wallets</option>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                  {method.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold text-white"
            style={{ background: ODOO.purple }}
          >
            Apply
          </button>
          {filtered ? (
            <Link
              href="/pos/orders"
              className="inline-flex h-10 items-center rounded-md px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-label="Totals for the orders below" className="mt-5">
        <p className="text-sm text-white/45">
          Wallet totals for the orders below. A split sale is counted in each wallet.
        </p>
        {truncated ? (
          <p className="mt-1 text-sm text-amber-200/90">
            {recentOnly
              ? `Showing the newest ${limit.toLocaleString('en-US')} orders. Pick a date to total every sale in a day.`
              : `Showing the newest ${limit.toLocaleString('en-US')} matching orders. Narrow the dates to include the rest.`}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(11rem,1fr)]">
          <article className="rounded-xl border border-white/10 p-4 shadow-lg sm:p-5" style={{ background: ODOO.purple }}>
            <p className="text-xs font-medium uppercase tracking-wide text-white/75">Total all wallets</p>
            <p className="mt-1 text-2xl font-semibold tabular tracking-tight text-white sm:text-3xl">{summary.total}</p>
            <p className="mt-1 text-xs text-white/70">Sum of every wallet on these orders</p>
          </article>
          <article className="rounded-xl border border-white/10 p-4" style={{ background: ODOO.surface }}>
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">Orders</p>
            <p className="mt-1 text-2xl font-semibold tabular text-white">{summary.orderCount}</p>
          </article>
        </div>

        {summary.wallets.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {summary.wallets.map((wallet) => {
              const selected = query.paymentMethodId === wallet.methodId
              return (
                <article
                  key={wallet.methodId}
                  className={cn(
                    'min-w-0 rounded-xl border p-4',
                    selected ? 'border-[#8fd4d7]' : 'border-white/10',
                  )}
                  style={{ background: ODOO.surface }}
                >
                  <p className="text-xs font-medium uppercase leading-snug tracking-wide text-white/50">
                    {wallet.name}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular text-white sm:text-xl">{wallet.total}</p>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      <div
        className="mt-5 overflow-x-auto rounded-xl border border-white/10"
        style={{ background: ODOO.surface }}
      >
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Register</th>
              <th className="px-4 py-3 font-medium">Payments</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">
                <span className="sr-only">Print</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-white/8 text-white/90">
                <td className="px-4 py-2.5 whitespace-nowrap text-white/60">{order.dateLabel}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link
                    href={`/sales/sales-receipts/${order.documentId}`}
                    className="font-medium text-[#8fd4d7] hover:underline"
                  >
                    {order.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{order.registerName}</td>
                <td className="px-4 py-2.5 text-white/65">{order.payments || '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular whitespace-nowrap">{order.total}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/45">
                  {filtered
                    ? 'No orders match these filters.'
                    : 'No POS orders yet. Open a session and continue selling.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
