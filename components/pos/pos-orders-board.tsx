'use client'

import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, SearchIcon, ShoppingCartIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, type KeyboardEvent } from 'react'

import { ODOO } from '@/lib/odoo-brand'
import { formatQty } from '@/lib/quantity'

const PAGE_SIZE = 7

export type PosOrderListRow = {
  id: string
  label: string
  reference: string
  customerName: string | null
  total: string
  day: string
  time: string
  status: 'ongoing' | 'paid'
  note: string
  lines: { name: string; quantity: number; amount: string; unitOfMeasure?: string | null }[]
  canDelete: boolean
  receiptHref: string | null
}

export function PosOrdersBoard({
  orders,
  selectedId,
  dark,
  onSelect,
  onOpen,
  onDelete,
}: {
  orders: PosOrderListRow[]
  /** The ticket the till is selling. Highlighted when it appears in the list. */
  selectedId: string | null
  dark: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'active' | 'paid'>('active')
  const [page, setPage] = useState(0)
  const [infoId, setInfoId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // A paid receipt can be previewed without becoming the open ticket.
  // When the till moves to another ticket, drop that preview.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  const [pickedId, setPickedId] = useState<string | null>(null)
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId)
    setPickedId(null)
  }
  const previewId = pickedId ?? selectedId

  const filtered = useMemo(() => {
    const status = filter === 'active' ? 'ongoing' : 'paid'
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      if (order.status !== status) return false
      if (!needle) return true
      return (
        order.label.toLowerCase().includes(needle) ||
        order.reference.toLowerCase().includes(needle) ||
        (order.customerName?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [filter, orders, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)
  const preview = orders.find((order) => order.id === previewId) ?? null
  const showDetail = preview != null && (preview.lines.length > 0 || infoId === preview.id || preview.status === 'paid')

  const text = dark ? '#f3f3f3' : '#1f1f23'
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const listBg = dark ? '#232328' : '#ffffff'
  const detailBg = dark ? '#141416' : '#f6f6f7'
  const fieldBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const selectedBg = dark ? '#245e5c' : '#d7ebe8'

  function pick(order: PosOrderListRow) {
    setPickedId(order.id)
    setConfirmId(null)
    if (order.status === 'ongoing') onSelect(order.id)
  }

  function searchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const typed = query.trim().toLowerCase()
    const exact = filtered.find(
      (order) => order.reference.toLowerCase() === typed || order.label.toLowerCase() === typed,
    )
    const hit = exact ?? (filtered.length === 1 ? filtered[0] : null)
    if (hit) pick(hit)
  }

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]" data-pos-view="orders">
      <section className="flex min-h-[18rem] flex-col border-b lg:border-b-0 lg:border-r" style={{ background: listBg, borderColor: border, color: text }}>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: border }}>
          <div className="relative min-w-[12rem] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
              onKeyDown={searchKey}
              placeholder="Search orders..."
              aria-label="Search orders"
              className="w-full rounded-full border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ background: fieldBg, borderColor: border, color: text }}
              autoComplete="off"
            />
          </div>
          <select
            id="pos-order-status"
            aria-label="Order status"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value === 'paid' ? 'paid' : 'active')
              setPage(0)
            }}
            className="h-9 rounded-md border px-2 text-sm outline-none"
            style={{ background: fieldBg, borderColor: border, color: text }}
          >
            <option value="active">Active</option>
            <option value="paid">Paid</option>
          </select>
          <div className="ml-auto flex items-center gap-1 text-sm tabular" style={{ color: muted }}>
            <span>
              {from}-{to} / {filtered.length}
            </span>
            <button
              type="button"
              aria-label="Previous orders"
              disabled={safePage === 0}
              onClick={() => setPage(Math.max(0, safePage - 1))}
              className="inline-flex size-8 items-center justify-center rounded-md disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next orders"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              className="inline-flex size-8 items-center justify-center rounded-md disabled:opacity-30"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {slice.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm" style={{ color: muted }}>
              {filter === 'active' ? 'No ongoing orders.' : 'No paid orders in this session.'}
            </li>
          ) : (
            slice.map((order) => {
              const on = order.id === previewId
              return (
                <li key={order.id} className="border-b" style={{ borderColor: border, background: on ? selectedBg : 'transparent' }}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`Order ${order.label}`}
                      onClick={() => pick(order)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          pick(order)
                        }
                      }}
                      className="grid min-w-0 flex-1 cursor-pointer grid-cols-[4.75rem_5.25rem_minmax(0,1fr)_auto] items-center gap-2 text-left"
                    >
                      <span className="min-w-0">
                        <span
                          className="block text-sm font-medium"
                          style={{ color: order.day === 'Today' ? (dark ? '#8fd0c8' : ODOO.tealDark) : text }}
                        >
                          {order.day}
                        </span>
                        {order.time ? (
                          <span className="block text-xs" style={{ color: muted }}>
                            {order.time}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold tabular">{order.label}</span>
                        <span className="block truncate font-mono text-[11px]" style={{ color: muted }}>
                          {order.reference}
                        </span>
                      </span>
                      <span className="truncate text-sm font-medium">{order.customerName ?? ''}</span>
                      <span className="text-sm font-semibold tabular">{order.total}</span>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        background: order.status === 'ongoing' ? '#7eaae8' : ODOO.teal,
                        color: order.status === 'ongoing' ? '#102033' : '#ffffff',
                      }}
                    >
                      {order.status === 'ongoing' ? 'Ongoing' : 'Paid'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Order details ${order.label}`}
                      title="Details"
                      onClick={() => {
                        setPickedId(order.id)
                        setInfoId(order.id)
                        if (order.status === 'ongoing') onSelect(order.id)
                      }}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full"
                      style={{ color: muted }}
                    >
                      <InfoIcon className="size-4" />
                    </button>
                    {order.canDelete ? (
                      confirmId === order.id ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-white"
                          style={{ background: ODOO.danger }}
                          onClick={() => {
                            setConfirmId(null)
                            onDelete(order.id)
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete order ${order.label}`}
                          title={order.lines.length === 0 ? 'Delete order' : 'Delete this order'}
                          onClick={() => {
                            if (order.lines.length === 0) onDelete(order.id)
                            else setConfirmId(order.id)
                          }}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                          style={{ color: muted }}
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      )
                    ) : (
                      <span className="size-8 shrink-0" />
                    )}
                  </div>
                </li>
              )
            })
          )}
        </ul>
        <div className="border-t px-3 py-2 text-xs" style={{ borderColor: border }}>
          <Link href="/pos/orders" className="underline" style={{ color: muted }}>
            Sales report
          </Link>
        </div>
      </section>

      <section className="flex min-h-[16rem] flex-col items-center justify-center px-6 py-10 text-center" style={{ background: detailBg, color: text }}>
        {showDetail && preview ? (
          <div className="flex w-full max-w-sm flex-col items-stretch text-left">
            <p className="text-xs font-medium" style={{ color: muted }}>
              {preview.status === 'ongoing' ? 'Ongoing' : 'Paid'} · {preview.reference}
            </p>
            <h2 className="mt-1 text-xl font-semibold">Order {preview.label}</h2>
            <p className="mt-1 text-sm">{preview.customerName ?? 'No customer'}</p>
            {preview.note ? (
              <p className="mt-2 text-sm" style={{ color: muted }}>
                {preview.note}
              </p>
            ) : null}
            {preview.lines.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {preview.lines.map((line, index) => (
                  <li key={`${line.name}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {line.name}
                      <span style={{ color: muted }}>
                        {' '}
                        × {formatQty(line.quantity, line.unitOfMeasure)}
                      </span>
                    </span>
                    <span className="tabular">{line.amount}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-4 flex justify-between border-t pt-3 text-base font-semibold" style={{ borderColor: border }}>
              <span>Total</span>
              <span className="tabular">{preview.total}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {preview.status === 'ongoing' ? (
                <button
                  type="button"
                  onClick={() => onOpen(preview.id)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: ODOO.teal }}
                >
                  Continue
                </button>
              ) : null}
              {preview.receiptHref ? (
                <a
                  href={preview.receiptHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ border: `1px solid ${border}`, color: text }}
                >
                  Print receipt
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4" style={{ color: muted }}>
            <ShoppingCartIcon className="size-16 stroke-[1.25] opacity-80" />
            <p className="text-base text-white/90" style={{ color: dark ? 'rgba(255,255,255,0.88)' : text }}>
              Select an order or scan QR code
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
