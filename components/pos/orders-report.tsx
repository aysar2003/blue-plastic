'use client'

import Link from 'next/link'

import {
  InteractiveGrid,
  type InteractiveColumn,
  type InteractiveRow,
} from '@/components/data/interactive-grid'
import { OrderDateField } from '@/components/pos/order-date-field'
import { ODOO } from '@/lib/odoo-brand'
import { DATE_PRESETS, listHref } from '@/lib/list-filters'
import type { CalendarDate } from '@/lib/date'
import { posOrderPresetParams, type PosOrderReportQuery } from '@/lib/pos-order-report'
import { cn } from '@/lib/utils'

export type PosOrdersReportOrder = {
  id: string
  dateLabel: string
  date: CalendarDate
  registerName: string
  posBankLabel: string
  posBankAccountId: string | null
  documentId: string
  number: string
  payments: string
  changeLabel: string | null
  total: string
  totalRaw: string
}

export type PosOrdersAccountTotal = {
  name: string
  tendered: string
  change: string
  net: string
}

export type PosOrdersWalletGrand = {
  tendered: string
  change: string
  net: string
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
  totals: PosOrdersAccountTotal[]
  grand: PosOrdersWalletGrand
  query: PosOrderReportQuery
  today: CalendarDate
  truncated: boolean
  limit: number
  currency: string
  timeZone: string
}

const controlClass =
  'mt-1 h-10 w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground outline-none focus:border-ring'

const ORDER_COLUMNS: InteractiveColumn[] = [
  { id: 'date', label: 'Date', kind: 'date', defaultWidth: 120 },
  { id: 'receipt', label: 'Receipt', defaultWidth: 120 },
  { id: 'register', label: 'Register', defaultWidth: 140 },
  { id: 'posBank', label: 'POS bank', defaultWidth: 200 },
  { id: 'payments', label: 'Payments', defaultWidth: 220 },
  { id: 'change', label: 'Change', defaultWidth: 140 },
  { id: 'total', label: 'Total', kind: 'money', total: true, defaultWidth: 120 },
  { id: 'print', label: 'Print', defaultWidth: 80, total: false },
]

export function PosOrdersReport({
  orders,
  summary,
  registers,
  methods,
  totals,
  grand,
  query,
  today,
  truncated,
  limit,
  currency,
  timeZone,
}: PosOrdersReportProps) {
  const filtered = query.preset !== '' || Boolean(query.registerId || query.paymentMethodId)
  const recentOnly = !query.from && !query.to && !query.registerId && !query.paymentMethodId

  const rows: InteractiveRow[] = orders.map((order) => ({
    id: order.id,
    cells: {
      date: { value: order.date, sort: order.date },
      receipt: {
        value: order.number,
        href: `/sales/sales-receipts/${order.documentId}`,
      },
      register: { value: order.registerName },
      posBank: {
        value: order.posBankLabel,
        href: order.posBankAccountId
          ? `/reports/transaction-detail?account=${order.posBankAccountId}`
          : null,
      },
      payments: { value: order.payments || '—' },
      change: { value: order.changeLabel ?? '—' },
      total: { value: order.totalRaw, sort: order.totalRaw },
      print: {
        value: 'Print',
        href: `/pos-receipt/${order.documentId}`,
      },
    },
  }))

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sales rung up at the till, posted to each register’s POS bank. Customize columns on the
        table below.
      </p>

      <form
        action="/pos/orders"
        method="get"
        aria-label="Filter orders"
        className="on-dark mt-5 rounded-xl border border-white/10 p-4"
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
          <OrderDateField
            id="from"
            name="from"
            label="From"
            defaultValue={query.from ?? ''}
            today={today}
          />
          <OrderDateField
            id="to"
            name="to"
            label="To"
            defaultValue={query.to ?? ''}
            today={today}
          />
          <label className="block text-xs font-medium uppercase tracking-wide text-white/75">
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
          <label className="block text-xs font-medium uppercase tracking-wide text-white/75">
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
        <p className="text-sm text-muted-foreground">
          Wallet totals for the orders below. A split sale is counted in each wallet.
        </p>
        {truncated ? (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
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
          <article className="on-dark rounded-xl border border-white/10 p-4" style={{ background: ODOO.surface }}>
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
                    'on-dark min-w-0 rounded-xl border p-4',
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

      <div className="mt-5">
        {orders.length === 0 ? (
          <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
            {filtered
              ? 'No orders match these filters.'
              : 'No POS orders yet. Open a session and continue selling.'}
          </div>
        ) : (
          <InteractiveGrid
            storageKey="bp-pos-orders"
            columns={ORDER_COLUMNS}
            rows={rows}
            currency={currency}
            timeZone={timeZone}
            customizable
            showTotal
          />
        )}
      </div>

      {totals.length > 0 ? (
        <div className="on-dark mt-4 overflow-hidden rounded-xl border border-white/10" style={{ background: ODOO.surface }}>
          <h2 className="px-4 py-3 text-sm font-semibold text-white">Received by wallet</h2>
          <p className="px-4 pb-2 text-xs text-white/45">
            Tendered is what was handed over. Net is what each wallet kept after change.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Wallet</th>
                <th className="px-4 py-2 text-right font-medium">Tendered</th>
                <th className="px-4 py-2 text-right font-medium">Change returned</th>
                <th className="px-4 py-2 text-right font-medium">Net received</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((total) => (
                <tr key={total.name} className="border-t border-white/8 text-white/90">
                  <td className="px-4 py-2">{total.name}</td>
                  <td className="px-4 py-2 text-right tabular">{total.tendered}</td>
                  <td className="px-4 py-2 text-right tabular">{total.change}</td>
                  <td className="px-4 py-2 text-right font-medium tabular">{total.net}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20 bg-black/30 font-semibold text-white">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular">{grand.tendered}</td>
                <td className="px-4 py-2 text-right tabular">{grand.change}</td>
                <td className="px-4 py-2 text-right tabular">{grand.net}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  )
}
