'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BanIcon,
  BarcodeIcon,
  FileTextIcon,
  KeyRoundIcon,
  Link2Icon,
  ListIcon,
  Loader2Icon,
  MenuIcon,
  MonitorIcon,
  MoreVerticalIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'

import { closePosSession, posCheckout, posRefund, recordPosCashMove } from '@/app/(app)/pos/actions'
import { RegisterLock, useClientReady, useRegisterLocked, writeRegisterLocked } from '@/components/pos/register-lock'
import { StockWarningNote } from '@/components/inventory/stock-warning'
import { ODOO } from '@/lib/odoo-brand'
import { chooseLineStore } from '@/lib/pos-line-store'
import { formatStockQty, negativeStockWarning } from '@/lib/store-stock'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

type Product = {
  id: string
  name: string
  sku: string | null
  category: string | null
  price: string
  /** On hand in this register's store; null for services / non-stock items. */
  onHand: string | null
  /** store id → on hand; null for services / non-stock items. */
  stock?: Record<string, string> | null
}

type PaymentMethod = { id: string; name: string; isCash: boolean }
type Customer = { id: string; displayName: string }
/** `storeId` null = automatic (counter store, else a store that has enough). */
type CartLine = { itemId: string; name: string; price: string; quantity: number; storeId: string | null }
type RecentOrder = {
  id: string
  documentId: string
  number: string
  total: string
  totalRaw: string
  customerName: string
  dateLabel: string
  payments: string
}

const THEME_KEY = 'pos-till-theme'

function broadcastCart(payload: {
  orgName: string
  lines: { name: string; quantity: number; amount: string }[]
  total: string
  customerName: string | null
}) {
  try {
    const channel = new BroadcastChannel('pos-customer-display')
    channel.postMessage(payload)
    channel.close()
  } catch {
    // Ignore — older browsers / private mode.
  }
}

/** The thermal till slip. Right after a sale it prints itself and shows the change given. */
function openReceiptPrint(documentId: string, options: { autoprint?: boolean; change?: number } = {}) {
  const query = new URLSearchParams()
  if (options.autoprint) query.set('autoprint', '1')
  if (options.change && options.change > 0.004) query.set('change', options.change.toFixed(2))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  window.open(`/pos-receipt/${documentId}${suffix}`, 'pos-receipt-print', 'noopener,noreferrer,width=420,height=800')
}

export function PosTerminal(props: {
  register: { id: string; name: string; paymentMethods: PaymentMethod[] }
  session: { id: string; dateLabel: string; openingCash: string; orderBadge: string }
  cashSummary: {
    expectedCash: string
    cashIn: string
    cashOut: string
    cashSales: string
    cashRefunds: string
  }
  recentOrders: RecentOrder[]
  products: Product[]
  /** Store the till sells from (register store, else the office). */
  stockStoreName?: string | null
  /** Its id, and every active store a line may be taken from instead. */
  stockStoreId?: string | null
  stores?: { id: string; name: string }[]
  customers: Customer[]
  currency: string
  orgName: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [dark, setDark] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [cashTendered, setCashTendered] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null)
  const [menu, setMenu] = useState<
    'actions' | 'burger' | 'cash' | 'customer' | 'note' | 'close' | 'refund' | null
  >(null)
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null)
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({})
  const [cashKind, setCashKind] = useState<'IN' | 'OUT'>('OUT')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')
  const [closingCash, setClosingCash] = useState(props.cashSummary.expectedCash)
  const [pending, startTransition] = useTransition()
  const ready = useClientReady()
  const locked = useRegisterLocked(props.register.id)

  const cashMethod = useMemo(
    () => props.register.paymentMethods.find((method) => method.isCash) ?? null,
    [props.register.paymentMethods],
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light') setDark(false)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    setClosingCash(props.cashSummary.expectedCash)
  }, [props.cashSummary.expectedCash])

  const customerName = useMemo(
    () => props.customers.find((row) => row.id === customerId)?.displayName ?? null,
    [customerId, props.customers],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return props.products
    return props.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false),
    )
  }, [props.products, query])

  // Selling below zero is allowed; these notes only tell the cashier it is happening.
  const productById = useMemo(() => new Map(props.products.map((product) => [product.id, product])), [props.products])
  const inCart = useMemo(() => new Map(cart.map((line) => [line.itemId, line.quantity])), [cart])
  const stockStore = props.stockStoreName ?? ''
  const stores = useMemo(() => props.stores ?? [], [props.stores])
  const storeName = useMemo(() => new Map(stores.map((store) => [store.id, store.name])), [stores])

  /** The store a cart line will be taken from — same rule the server applies. */
  function lineStore(line: CartLine): string | null {
    const product = productById.get(line.itemId)
    return chooseLineStore({
      requested: line.storeId,
      counterStoreId: props.stockStoreId ?? null,
      tracked: product?.stock != null,
      quantity: line.quantity,
      onHandByStore: product?.stock ?? {},
      activeStoreIds: stores.map((store) => store.id),
    })
  }

  function setLineStore(itemId: string, storeId: string | null) {
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, storeId } : line)))
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0),
    [cart],
  )

  useEffect(() => {
    broadcastCart({
      orgName: props.orgName,
      customerName,
      total: formatMoney(subtotal, props.currency),
      lines: cart.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        amount: formatMoney(Number(line.price) * line.quantity, props.currency),
      })),
    })
  }, [cart, customerName, props.currency, props.orgName, subtotal])

  function addProduct(product: Product) {
    setToast(null)
    setLastReceiptId(null)
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === product.id)
      if (existing) {
        return prev.map((line) =>
          line.itemId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...prev,
        { itemId: product.id, name: product.name, price: product.price, quantity: 1, storeId: null },
      ]
    })
  }

  function tryBarcodeAdd() {
    const q = query.trim()
    if (!q) return false
    const exactSku = props.products.find(
      (product) => product.sku && product.sku.toLowerCase() === q.toLowerCase(),
    )
    if (exactSku) {
      addProduct(exactSku)
      setQuery('')
      setToast(`Added ${exactSku.name}`)
      return true
    }
    if (filtered.length === 1) {
      addProduct(filtered[0]!)
      setQuery('')
      setToast(`Added ${filtered[0]!.name}`)
      return true
    }
    return false
  }

  function setQty(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((line) => line.itemId !== itemId))
      return
    }
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)))
  }

  function cancelOrder() {
    setCart([])
    setNote('')
    setCustomerId(null)
    setMenu(null)
    setToast('Order cancelled')
  }

  function openPay() {
    if (cart.length === 0) return
    const first = props.register.paymentMethods[0]
    const defaults: Record<string, string> = {}
    if (cashMethod) {
      defaults[cashMethod.id] = subtotal.toFixed(2)
      setCashTendered(subtotal.toFixed(2))
    } else if (first) {
      defaults[first.id] = subtotal.toFixed(2)
      setCashTendered('')
    }
    setAmounts(defaults)
    setError(null)
    setPayOpen(true)
  }

  const nonCashPaid = useMemo(() => {
    return props.register.paymentMethods
      .filter((method) => !method.isCash)
      .reduce((sum, method) => sum + (Number(amounts[method.id]) || 0), 0)
  }, [amounts, props.register.paymentMethods])

  const cashDue = Math.max(0, subtotal - nonCashPaid)
  const tendered = Number(cashTendered) || 0
  const changeDue = cashMethod ? Math.max(0, tendered - cashDue) : 0

  const paymentSum = useMemo(() => {
    let sum = nonCashPaid
    if (cashMethod && cashDue > 0) sum += cashDue
    if (!cashMethod) {
      sum = Object.values(amounts).reduce((total, value) => total + (Number(value) || 0), 0)
    }
    return sum
  }, [amounts, cashDue, cashMethod, nonCashPaid])

  function fillRemaining(methodId: string) {
    const others = Object.entries(amounts)
      .filter(([id]) => id !== methodId)
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
    const remaining = Math.max(0, subtotal - others).toFixed(2)
    setAmounts((prev) => ({ ...prev, [methodId]: remaining }))
    if (cashMethod && methodId === cashMethod.id) setCashTendered(remaining)
  }

  function buildCheckoutPayments():
    | { ok: true; payments: { paymentMethodId: string; amount: string }[] }
    | { ok: false; error: string } {
    if (cashMethod) {
      const payments = props.register.paymentMethods
        .filter((method) => !method.isCash)
        .map((method) => ({
          paymentMethodId: method.id,
          amount: amounts[method.id]?.trim() ?? '',
        }))
        .filter((payment) => payment.amount && Number(payment.amount) > 0)

      if (cashDue > 0.009) {
        if (tendered + 0.009 < cashDue) {
          return { ok: false, error: 'Cash tendered is less than the amount due.' }
        }
        payments.push({ paymentMethodId: cashMethod.id, amount: cashDue.toFixed(2) })
      }

      if (payments.length === 0) {
        return { ok: false, error: 'Enter at least one payment amount.' }
      }

      const sum = payments.reduce((total, payment) => total + Number(payment.amount), 0)
      if (Math.abs(sum - subtotal) > 0.009) {
        return { ok: false, error: 'Payment amounts must equal the total.' }
      }
      return { ok: true, payments }
    }

    const payments = props.register.paymentMethods
      .map((method) => ({
        paymentMethodId: method.id,
        amount: amounts[method.id]?.trim() ?? '',
      }))
      .filter((payment) => payment.amount && Number(payment.amount) > 0)

    if (payments.length === 0) {
      return { ok: false, error: 'Enter at least one payment amount.' }
    }
    if (Math.abs(paymentSum - subtotal) > 0.009) {
      return { ok: false, error: 'Payment amounts must equal the total.' }
    }
    return { ok: true, payments }
  }

  function completeSale() {
    setError(null)
    const built = buildCheckoutPayments()
    if (!built.ok) {
      setError(built.error)
      return
    }

    // Change is only known here; the receipt shows it on the first print.
    const changeAtSale = changeDue
    startTransition(async () => {
      const result = await posCheckout({
        registerId: props.register.id,
        sessionId: props.session.id,
        customerId: customerId ?? undefined,
        note: note || null,
        lines: cart.map((line) => ({
          itemId: line.itemId,
          quantity: String(line.quantity),
          storeId: line.storeId ?? undefined,
        })),
        payments: built.payments,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setPayOpen(false)
      setCart([])
      setNote('')
      setAmounts({})
      setCashTendered('')
      setLastReceiptId(result.data.id)
      setToast(`Receipt ${result.data.number} · ${formatMoney(result.data.total, props.currency)}`)
      openReceiptPrint(result.data.id, { autoprint: true, change: changeAtSale })
      router.refresh()
    })
  }

  function submitCashMove() {
    setError(null)
    startTransition(async () => {
      const result = await recordPosCashMove({
        sessionId: props.session.id,
        kind: cashKind,
        amount: cashAmount,
        reason: cashReason || null,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setMenu(null)
      setCashAmount('')
      setCashReason('')
      setToast(cashKind === 'IN' ? 'Cash in recorded' : 'Cash out recorded')
      router.refresh()
    })
  }

  function submitClose() {
    setError(null)
    startTransition(async () => {
      const result = await closePosSession({
        sessionId: props.session.id,
        closingCash,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push('/pos')
      router.refresh()
    })
  }

  function openRefund() {
    setError(null)
    setRefundOrderId(null)
    setRefundAmounts({})
    setMenu('refund')
  }

  function selectRefundOrder(order: RecentOrder) {
    setRefundOrderId(order.id)
    const defaults: Record<string, string> = {}
    const method = cashMethod ?? props.register.paymentMethods[0]
    if (method) defaults[method.id] = Number(order.totalRaw).toFixed(2)
    setRefundAmounts(defaults)
    setError(null)
  }

  function submitRefund() {
    setError(null)
    if (!refundOrderId) {
      setError('Pick a receipt to refund.')
      return
    }
    const payments = props.register.paymentMethods
      .map((method) => ({
        paymentMethodId: method.id,
        amount: refundAmounts[method.id]?.trim() ?? '',
      }))
      .filter((payment) => payment.amount && Number(payment.amount) > 0)

    if (payments.length === 0) {
      setError('Enter at least one refund amount.')
      return
    }

    startTransition(async () => {
      const result = await posRefund({
        registerId: props.register.id,
        sessionId: props.session.id,
        orderId: refundOrderId,
        payments,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setMenu(null)
      setRefundOrderId(null)
      setRefundAmounts({})
      setToast(`Refund ${result.data.number} · ${formatMoney(result.data.total, props.currency)}`)
      window.open(
        `/sales/refunds/${result.data.id}/print`,
        'pos-refund-print',
        'noopener,noreferrer,width=900,height=1000',
      )
      router.refresh()
    })
  }

  function openCustomerDisplay() {
    window.open(`/pos/${props.register.id}/display`, 'pos-customer-display', 'noopener,noreferrer,width=900,height=700')
    setMenu(null)
  }

  const closeVariance = useMemo(() => {
    const expected = Number(props.cashSummary.expectedCash) || 0
    const counted = Number(closingCash) || 0
    return counted - expected
  }, [closingCash, props.cashSummary.expectedCash])

  if (!ready) return null

  const bg = dark ? ODOO.ink : ODOO.wash
  const panel = dark ? ODOO.surface : '#ffffff'
  const text = dark ? '#f3f3f3' : '#1f1f23'
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const chip = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col" style={{ background: bg, color: text }}>
      <header
        className="flex flex-wrap items-center gap-2 border-b px-2 py-2 sm:px-3"
        style={{ borderColor: border, background: dark ? '#161618' : '#fff' }}
      >
        <div className="flex items-center gap-1">
          <span
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{
              background: dark ? 'transparent' : '#d1e7dd',
              border: `1px solid ${ODOO.teal}`,
              color: dark ? '#fff' : ODOO.tealDark,
            }}
          >
            Register
          </span>
          <Link
            href="/pos/orders"
            className="rounded-md px-3 py-1.5 text-sm"
            style={{ border: `1px solid ${border}`, color: text }}
          >
            Orders
          </Link>
          <button
            type="button"
            onClick={cancelOrder}
            className="inline-flex size-8 items-center justify-center rounded-md"
            style={{ border: `1px solid ${border}` }}
            title="New order"
          >
            <PlusIcon className="size-4" />
          </button>
          <span
            className="rounded-md px-2.5 py-1.5 text-sm font-semibold tabular"
            style={{ border: `1px solid ${ODOO.teal}`, color: dark ? '#9fe0e3' : ODOO.tealDark }}
          >
            {props.session.orderBadge}
          </span>
        </div>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:max-w-xl">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
            <input
              type="search"
              placeholder="Search products..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  tryBarcodeAdd()
                }
              }}
              className="w-full rounded-full border py-2 pl-9 pr-10 text-sm outline-none"
              style={{ background: chip, borderColor: border, color: text }}
              autoComplete="off"
            />
            <BarcodeIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          </div>
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: ODOO.danger }}
          >
            {(props.orgName.trim()[0] ?? 'P').toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => setMenu('burger')}
            className="inline-flex size-9 items-center justify-center rounded-md"
            style={{ border: `1px solid ${border}` }}
            aria-label="Menu"
          >
            <MenuIcon className="size-4" />
          </button>
        </div>
      </header>

      {toast ? (
        <div
          className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-sm"
          style={{ background: `${ODOO.teal}22`, color: dark ? '#9fe0e3' : ODOO.tealDark }}
        >
          <span>{toast}</span>
          {lastReceiptId ? (
            <button
              type="button"
              className="underline"
              onClick={() => openReceiptPrint(lastReceiptId)}
            >
              Print receipt
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
        {/* Total and Payment sit at the top of the cart and the panel stays pinned while the
            product grid scrolls, so paying never needs a scroll (laptops at ~1024x576). */}
        <aside
          className="flex min-h-[18rem] flex-col border-b lg:sticky lg:top-0 lg:max-h-svh lg:self-start lg:border-b-0 lg:border-r"
          style={{ background: panel, borderColor: border }}
        >
          <div className="shrink-0 border-b p-3" style={{ borderColor: border }}>
            <div className="mb-3 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{formatMoney(subtotal, props.currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMenu('customer')}
                className="min-w-0 flex-1 truncate rounded-lg px-3 py-2.5 text-sm font-medium"
                style={{ border: `1px solid ${border}`, background: chip }}
              >
                {customerName ?? 'Customer'}
              </button>
              <button
                type="button"
                onClick={() => setMenu('note')}
                className="rounded-lg px-3 py-2.5 text-sm font-medium"
                style={{ border: `1px solid ${border}`, background: chip }}
              >
                Note{note ? ' ·' : ''}
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || pending}
                onClick={openPay}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: ODOO.teal }}
                title="Pay"
              >
                <UploadIcon className="size-4" />
                Payment
              </button>
              <button
                type="button"
                onClick={() => setMenu('actions')}
                className="inline-flex size-10 items-center justify-center rounded-lg"
                style={{ border: `1px solid ${border}` }}
                aria-label="Actions"
              >
                <MoreVerticalIcon className="size-4" />
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {cart.map((line) => (
              <li
                key={line.itemId}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm"
                style={{ background: chip }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs" style={{ color: muted }}>
                    {formatMoney(line.price, props.currency)} · qty {line.quantity}
                  </p>
                  {(() => {
                    const product = productById.get(line.itemId)
                    if (!product?.stock) return null
                    const from = lineStore(line)
                    const fromName = (from && storeName.get(from)) || stockStore
                    const auto = lineStore({ ...line, storeId: null })
                    const autoName = (auto && storeName.get(auto)) || stockStore
                    const onHand = from ? Number(product.stock[from] ?? 0) : Number(product.onHand ?? 0)
                    const elsewhere = Boolean(from && props.stockStoreId && from !== props.stockStoreId)
                    return (
                      <>
                        {stores.length > 1 ? (
                          <label
                            className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs"
                            style={{ color: elsewhere ? (dark ? '#f5c97a' : '#9a5b00') : muted }}
                          >
                            From
                            <select
                              data-line-store={line.itemId}
                              value={line.storeId ?? ''}
                              onChange={(event) => setLineStore(line.itemId, event.target.value || null)}
                              className="min-w-0 max-w-[11rem] rounded border px-1 py-0.5 text-xs"
                              // Native selects ignore a transparent background; set both
                              // colours so the text stays readable in the dark till.
                              style={{
                                borderColor: border,
                                background: dark ? '#1f1f23' : '#ffffff',
                                color: dark ? '#f4f4f5' : '#18181b',
                                colorScheme: dark ? 'dark' : 'light',
                              }}
                            >
                              <option value="">Auto · {autoName}</option>
                              {stores.map((store) => (
                                <option key={store.id} value={store.id}>
                                  {store.name} ({formatStockQty(Number(product.stock?.[store.id] ?? 0))})
                                </option>
                              ))}
                            </select>
                            {elsewhere ? <span className="whitespace-nowrap">· pick ticket</span> : null}
                          </label>
                        ) : null}
                        <StockWarningNote
                          warning={negativeStockWarning(onHand, line.quantity, fromName)}
                          tone={dark ? 'dark' : 'light'}
                        />
                      </>
                    )
                  })()}
                </div>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => setQty(line.itemId, Number(event.target.value))}
                  className="w-14 rounded border bg-transparent px-1 py-0.5 text-center text-sm"
                  style={{ borderColor: border }}
                />
                <button type="button" onClick={() => setQty(line.itemId, 0)} aria-label="Remove">
                  <Trash2Icon className="size-4 opacity-60" />
                </button>
              </li>
            ))}
            {cart.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm" style={{ color: muted }}>
                Tap a product or scan a barcode.
              </li>
            ) : null}
          </ul>

        </aside>

        <section className="flex min-h-0 flex-col p-3 sm:p-4">
          {props.products.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <FileTextIcon className="size-16 opacity-30" />
              <h2 className="text-xl font-semibold">No Product Yet?</h2>
              <p className="max-w-sm text-sm" style={{ color: muted }}>
                Mark items as available in POS, or create a product in the backend. Scanning a known
                SKU adds it when the catalogue is loaded.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/items"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: ODOO.purple }}
                >
                  Create Product
                </Link>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ border: `1px solid ${border}` }}
                >
                  Reload Data
                </button>
              </div>
            </div>
          ) : (
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                // &:hover tracks the pointer on a touch-first till, where the primary pointer is not a mouse.
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex cursor-pointer flex-col rounded-xl border border-[color:var(--product-border)] bg-[var(--product-bg)] p-3 text-left transition-colors duration-200 ease-out [&:hover]:border-[color:var(--product-hover-border)] [&:hover]:bg-[var(--product-hover-bg)] focus-visible:border-[color:var(--product-hover-border)] focus-visible:bg-[var(--product-hover-bg)] focus-visible:outline-none"
                  style={
                    {
                      '--product-bg': panel,
                      '--product-border': border,
                      '--product-hover-border': ODOO.teal,
                      '--product-hover-bg': dark ? '#226066' : '#dfeef0',
                    } as React.CSSProperties
                  }
                >
                  <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                  {product.sku ? (
                    <span className="mt-1 font-mono text-xs" style={{ color: muted }}>
                      {product.sku}
                    </span>
                  ) : null}
                  {product.category ? (
                    <span className="mt-1 text-xs" style={{ color: muted }}>
                      {product.category}
                    </span>
                  ) : null}
                  {(() => {
                    if (product.onHand == null) return null
                    // What is left once the cart is sold; shown only when below zero.
                    return (
                      <StockWarningNote
                        warning={negativeStockWarning(
                          Number(product.onHand),
                          inCart.get(product.id) ?? 0,
                          stockStore,
                        )}
                        tone={dark ? 'dark' : 'light'}
                      />
                    )
                  })()}
                  <span
                    className="mt-auto pt-2 text-sm font-semibold"
                    style={{ color: dark ? '#9fe0e3' : ODOO.teal }}
                  >
                    {formatMoney(product.price, props.currency)}
                  </span>
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="col-span-full text-sm" style={{ color: muted }}>
                  No products match that search. Press Enter only adds an exact SKU match.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {menu === 'actions' ? (
        <Modal title="Actions" dark={dark} onClose={() => setMenu(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionTile
              label="Customer Note"
              icon={<FileTextIcon className="size-6" />}
              onClick={() => setMenu('note')}
              dark={dark}
            />
            <ActionTile
              label="Refund"
              icon={<Undo2Icon className="size-6" />}
              onClick={openRefund}
              dark={dark}
            />
            <ActionTile
              label="Quotation / Order"
              icon={<Link2Icon className="size-6" />}
              onClick={() => {
                setMenu(null)
                router.push('/sales/estimates/new')
              }}
              dark={dark}
            />
            <ActionTile
              label="Pricelist"
              icon={<ListIcon className="size-6" />}
              onClick={() => {
                setToast('Sales price from product master is used at the till.')
                setMenu(null)
              }}
              dark={dark}
            />
            <ActionTile
              label="Cancel Order"
              icon={<BanIcon className="size-6" />}
              onClick={cancelOrder}
              dark={dark}
              danger
            />
          </div>
        </Modal>
      ) : null}

      {menu === 'burger' ? (
        <Modal title={props.register.name} dark={dark} onClose={() => setMenu(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionTile
              label="Customer Display"
              icon={<MonitorIcon className="size-6" />}
              onClick={openCustomerDisplay}
              dark={dark}
            />
            <ActionTile
              label={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              icon={dark ? <SunIcon className="size-6" /> : <MoonIcon className="size-6" />}
              onClick={() => {
                setDark((value) => !value)
                setMenu(null)
              }}
              dark={dark}
            />
            <ActionTile
              label="Cash In/Out"
              icon={<BanknoteIcon className="size-6" />}
              onClick={() => {
                setCashKind('OUT')
                setMenu('cash')
              }}
              dark={dark}
            />
            <ActionTile
              label="Refund"
              icon={<Undo2Icon className="size-6" />}
              onClick={openRefund}
              dark={dark}
            />
            <ActionTile
              label="Reload Data"
              icon={<RefreshCwIcon className="size-6" />}
              onClick={() => {
                router.refresh()
                setMenu(null)
                setToast('Catalogue refreshed')
              }}
              dark={dark}
            />
            <ActionTile
              label="Create Product"
              icon={<PlusIcon className="size-6" />}
              onClick={() => {
                setMenu(null)
                router.push('/items')
              }}
              dark={dark}
            />
            <ActionTile
              label="Backend"
              icon={<ArrowLeftIcon className="size-6" />}
              onClick={() => router.push('/pos')}
              dark={dark}
            />
            <ActionTile
              label="Close Register"
              icon={<KeyRoundIcon className="size-6" />}
              onClick={() => setMenu('close')}
              dark={dark}
              danger
            />
            <ActionTile
              label="Lock"
              icon={<KeyRoundIcon className="size-6" />}
              onClick={() => {
                writeRegisterLocked(props.register.id, true)
                setMenu(null)
              }}
              dark={dark}
            />
          </div>
        </Modal>
      ) : null}

      {menu === 'cash' ? (
        <Modal title="Cash In / Cash Out" dark={dark} onClose={() => setMenu(null)}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCashKind('IN')}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                background: cashKind === 'IN' ? chip : 'transparent',
                border: `1px solid ${border}`,
              }}
            >
              Cash In
            </button>
            <button
              type="button"
              onClick={() => setCashKind('OUT')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{
                background: cashKind === 'OUT' ? ODOO.danger : chip,
                border: `1px solid ${border}`,
              }}
            >
              Cash Out
            </button>
            <label
              className="ml-auto flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: border }}
            >
              <span style={{ color: muted }}>$</span>
              <input
                value={cashAmount}
                onChange={(event) => setCashAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-24 bg-transparent outline-none"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm" style={{ color: muted }}>
            Reason
            <textarea
              value={cashReason}
              onChange={(event) => setCashReason(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border p-3 text-sm outline-none"
              style={{ background: chip, borderColor: border, color: text }}
            />
          </label>
          {error && menu === 'cash' ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitCashMove}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: ODOO.purple }}
            >
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setMenu(null)}
              className="rounded-lg px-4 py-2 text-sm"
              style={{ border: `1px solid ${border}` }}
            >
              Discard
            </button>
          </div>
        </Modal>
      ) : null}

      {menu === 'customer' ? (
        <Modal title="Customer" dark={dark} onClose={() => setMenu(null)}>
          <button
            type="button"
            className="mb-2 w-full rounded-lg px-3 py-2 text-left text-sm"
            style={{ background: chip }}
            onClick={() => {
              setCustomerId(null)
              setMenu(null)
            }}
          >
            Walk-in (register default)
          </button>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {props.customers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-90"
                  style={{ background: customerId === customer.id ? `${ODOO.purple}44` : chip }}
                  onClick={() => {
                    setCustomerId(customer.id)
                    setMenu(null)
                  }}
                >
                  {customer.displayName}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {menu === 'note' ? (
        <Modal title="Customer Note" dark={dark} onClose={() => setMenu(null)}>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            placeholder="Note on this order…"
            className="w-full rounded-lg border p-3 text-sm outline-none"
            style={{ background: chip, borderColor: border, color: text }}
          />
          <button
            type="button"
            className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: ODOO.purple }}
            onClick={() => setMenu(null)}
          >
            Done
          </button>
        </Modal>
      ) : null}

      {menu === 'close' ? (
        <Modal title="Close Register" dark={dark} onClose={() => setMenu(null)}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt style={{ color: muted }}>Opening</dt>
            <dd className="text-right tabular">{props.session.openingCash}</dd>
            <dt style={{ color: muted }}>Cash sales</dt>
            <dd className="text-right tabular">{formatMoney(props.cashSummary.cashSales, props.currency)}</dd>
            <dt style={{ color: muted }}>Cash refunds</dt>
            <dd className="text-right tabular">
              −{formatMoney(props.cashSummary.cashRefunds, props.currency)}
            </dd>
            <dt style={{ color: muted }}>Cash in</dt>
            <dd className="text-right tabular">
              +{formatMoney(props.cashSummary.cashIn, props.currency)}
            </dd>
            <dt style={{ color: muted }}>Cash out</dt>
            <dd className="text-right tabular">
              −{formatMoney(props.cashSummary.cashOut, props.currency)}
            </dd>
            <dt className="font-semibold">Expected</dt>
            <dd className="text-right font-semibold tabular">
              {formatMoney(props.cashSummary.expectedCash, props.currency)}
            </dd>
          </dl>
          <label className="mt-4 block text-sm">
            Counted cash ({props.currency})
            <input
              value={closingCash}
              onChange={(event) => setClosingCash(event.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: chip, borderColor: border, color: text }}
            />
          </label>
          <p
            className={cn(
              'mt-2 text-sm tabular',
              Math.abs(closeVariance) < 0.01
                ? 'text-emerald-400'
                : closeVariance < 0
                  ? 'text-red-400'
                  : 'text-amber-400',
            )}
          >
            Variance:{' '}
            {closeVariance >= 0 ? '+' : ''}
            {formatMoney(closeVariance, props.currency)}
            {Math.abs(closeVariance) < 0.01 ? ' (balanced)' : closeVariance < 0 ? ' (short)' : ' (over)'}
          </p>
          {error && menu === 'close' ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={pending}
            onClick={submitClose}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: ODOO.danger }}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Close Register
          </button>
        </Modal>
      ) : null}

      {menu === 'refund' ? (
        <Modal title="Refund" dark={dark} onClose={() => setMenu(null)}>
          {!refundOrderId ? (
            <>
              <p className="mb-3 text-sm" style={{ color: muted }}>
                Pick a receipt from this session to refund in full.
              </p>
              {props.recentOrders.length === 0 ? (
                <p className="text-sm" style={{ color: muted }}>
                  No sales on this session yet.
                </p>
              ) : (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {props.recentOrders.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm"
                        style={{ background: chip }}
                        onClick={() => selectRefundOrder(order)}
                      >
                        <span className="font-medium">{order.number}</span>
                        <span className="ml-2 tabular">{order.total}</span>
                        <span className="mt-0.5 block text-xs" style={{ color: muted }}>
                          {order.dateLabel} · {order.customerName}
                          {order.payments ? ` · ${order.payments}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: muted }}>
                Refunding{' '}
                <span className="font-medium" style={{ color: text }}>
                  {props.recentOrders.find((order) => order.id === refundOrderId)?.number}
                </span>{' '}
                ·{' '}
                {props.recentOrders.find((order) => order.id === refundOrderId)?.total}
              </p>
              <ul className="mt-4 space-y-3">
                {props.register.paymentMethods.map((method) => (
                  <li key={method.id} className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-sm font-medium">{method.name}</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={refundAmounts[method.id] ?? ''}
                      onChange={(event) =>
                        setRefundAmounts((prev) => ({ ...prev, [method.id]: event.target.value }))
                      }
                      className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
                      style={{ background: chip, borderColor: border, color: text }}
                    />
                  </li>
                ))}
              </ul>
              {error && menu === 'refund' ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRefundOrderId(null)
                    setError(null)
                  }}
                  className="rounded-lg px-4 py-2 text-sm"
                  style={{ border: `1px solid ${border}` }}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={submitRefund}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: ODOO.purple }}
                >
                  {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  Validate refund
                </button>
              </div>
            </>
          )}
        </Modal>
      ) : null}

      {payOpen ? (
        <Modal title="Payment" dark={dark} onClose={() => setPayOpen(false)}>
          <p className="text-2xl font-semibold tabular">{formatMoney(subtotal, props.currency)}</p>
          <ul className="mt-4 space-y-3">
            {props.register.paymentMethods.map((method) =>
              method.isCash ? (
                <li key={method.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-sm font-medium">{method.name} due</label>
                    <input
                      type="number"
                      readOnly
                      value={cashDue.toFixed(2)}
                      className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none opacity-80"
                      style={{ background: chip, borderColor: border, color: text }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-sm font-medium">Tendered</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashTendered}
                      onChange={(event) => {
                        setCashTendered(event.target.value)
                        setAmounts((prev) => ({ ...prev, [method.id]: cashDue.toFixed(2) }))
                      }}
                      className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
                      style={{ background: chip, borderColor: border, color: text }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCashTendered(cashDue.toFixed(2))
                        fillRemaining(method.id)
                      }}
                      className="text-xs"
                      style={{ color: ODOO.teal }}
                    >
                      Exact
                    </button>
                  </div>
                </li>
              ) : (
                <li key={method.id} className="flex items-center gap-2">
                  <label className="w-28 shrink-0 text-sm font-medium">{method.name}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amounts[method.id] ?? ''}
                    onChange={(event) =>
                      setAmounts((prev) => ({ ...prev, [method.id]: event.target.value }))
                    }
                    className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={{ background: chip, borderColor: border, color: text }}
                  />
                  <button
                    type="button"
                    onClick={() => fillRemaining(method.id)}
                    className="text-xs"
                    style={{ color: ODOO.teal }}
                  >
                    Remaining
                  </button>
                </li>
              ),
            )}
          </ul>
          {cashMethod ? (
            <p className="mt-2 text-sm tabular" style={{ color: changeDue > 0.009 ? ODOO.teal : muted }}>
              Change due: {formatMoney(changeDue, props.currency)}
            </p>
          ) : (
            <p
              className={cn(
                'mt-2 text-sm',
                Math.abs(paymentSum - subtotal) < 0.01 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              Paid: {formatMoney(paymentSum, props.currency)}
            </p>
          )}
          {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="rounded-md border px-4 py-2 text-sm"
              style={{ borderColor: border }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={completeSale}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: ODOO.purple }}
            >
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Validate
            </button>
          </div>
        </Modal>
      ) : null}

      {locked ? (
        <RegisterLock orgName={props.orgName} onUnlock={() => writeRegisterLocked(props.register.id, false)} />
      ) : null}
    </div>
  )
}

function Modal({
  title,
  dark,
  onClose,
  children,
}: {
  title: string
  dark: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-5"
        style={{
          background: dark ? ODOO.surface : '#fff',
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          color: dark ? '#f3f3f3' : '#1f1f23',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            <XIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ActionTile({
  label,
  icon,
  onClick,
  dark,
  danger,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  dark: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl p-3 text-center text-sm font-medium"
      style={{
        background: danger ? ODOO.danger : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        color: danger ? '#fff' : undefined,
      }}
    >
      {icon}
      <span className="leading-tight">{label}</span>
    </button>
  )
}
