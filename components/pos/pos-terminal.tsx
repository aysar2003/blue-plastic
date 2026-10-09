'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
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

import {
  closePosSession,
  posCheckout,
  posCreateQuotation,
  posLoadQuotation,
  posRefund,
  recordPosCashMove,
} from '@/app/(app)/pos/actions'
import { PosPaymentForm } from '@/components/pos/payment-dialog'
import { RegisterTransferForm, type TransferDestination } from '@/components/pos/register-transfer-form'
import { RegisterLock, useClientReady, useRegisterLocked, writeRegisterLocked } from '@/components/pos/register-lock'
import { StockWarningNote } from '@/components/inventory/stock-warning'
import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { ODOO } from '@/lib/odoo-brand'
import { usePropState } from '@/lib/use-prop-state'
import { minorUnits, formatMoney } from '@/lib/money'
import { chooseLineStore } from '@/lib/pos-line-store'
import { CHANGE_ACCOUNT_MESSAGE, changeReturnChoices, paymentCanValidate } from '@/lib/pos-change'
import {
  activePosOrder,
  addPosOrder,
  clearPosOrder,
  closePosOrder,
  createPosOrderBook,
  loadPosOrderBook,
  patchPosOrder,
  POS_OPEN_ORDER_LIMIT,
  posOrderIsEmpty,
  type PosOpenCartLine,
  type PosOrderBook,
  savePosOrderBook,
  selectPosOrder,
  settlePosOrder,
} from '@/lib/pos-open-orders'
import {
  clampPaymentDraft,
  exactRemainingAmount,
  nonCashDraftError,
  prefilledPaymentAmounts,
  settlePosPayments,
} from '@/lib/pos-payment'
import { POS_SHORTFALL_DISCOUNT_MAX } from '@/lib/pos-shortfall'
import { formatStockQty, negativeStockWarning } from '@/lib/store-stock'
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

type PaymentMethod = { id: string; name: string; isCash: boolean; allowsChangeReturn: boolean }
type Customer = { id: string; displayName: string }
/** `storeId` null = automatic (counter store, else a store that has enough). */
type CartLine = PosOpenCartLine
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

type OpenQuote = {
  id: string
  number: string
  dateLabel: string
  totalLabel: string
  customerId: string
  customerName: string
  lineCount: number
}

const THEME_KEY = 'pos-till-theme'
const EMPTY_CART: CartLine[] = []

function orderTabStyle(selected: boolean, dark: boolean, border: string, text: string) {
  if (!selected) {
    return { border: `1px solid ${border}`, color: text, background: 'transparent' }
  }
  return {
    background: dark ? 'transparent' : '#d1e7dd',
    border: `1px solid ${ODOO.teal}`,
    color: dark ? '#ffffff' : ODOO.tealDark,
  }
}

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
  /** Signed-in cashier. Open tickets are stored for this user only. */
  cashierUserId: string
  register: {
    id: string
    name: string
    paymentMethods: PaymentMethod[]
    /** Null means open on the cash method. */
    defaultChangeMethodId: string | null
    allowWalletChangeReturn: boolean
  }
  session: { id: string; dateLabel: string; openingCash: string }
  cashSummary: {
    expectedCash: string
    cashIn: string
    cashOut: string
    cashSales: string
    cashRefunds: string
  }
  tillBalance?: { balance: string; balanceRaw: string } | null
  transferDestinations?: TransferDestination[]
  recentOrders: RecentOrder[]
  openQuotations?: OpenQuote[]
  /** Show quotation tools (invoice:create or invoice:read). */
  canQuote?: boolean
  /** May save the cart as a quotation. */
  canCreateQuote?: boolean
  products: Product[]
  /** Store the till sells from (register store, else the office). */
  stockStoreName?: string | null
  /** Its id, and every active store a line may be taken from instead. */
  stockStoreId?: string | null
  stores?: { id: string; name: string }[]
  customers: Customer[]
  currency: string
  orgName: string
  /**
   * Method Payment fills with the amount due. Computed when the till loads,
   * so opening the dialog does not wait on past sales.
   */
  usualPaymentMethodId?: string | null
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  // No window during the server render, so the till starts from a blank
  // Register ticket there. In the browser the signed-in cashier's tickets for
  // this session are read before paint, and a refresh keeps them.
  const ticketKey = `${props.cashierUserId}\0${props.session.id}`
  const [book, setBook] = useState<PosOrderBook | null>(() =>
    typeof window === 'undefined' ? createPosOrderBook() : null,
  )
  const [storedFor, setStoredFor] = useState<string | null>(null)
  if (typeof window !== 'undefined' && storedFor !== ticketKey) {
    setStoredFor(ticketKey)
    setBook(loadPosOrderBook(window.localStorage, props.cashierUserId, props.session.id))
  }
  const bookRef = useRef<PosOrderBook | null>(book)
  const themeStored = useBrowserStore(THEME_KEY)
  const dark = themeStored !== 'light'
  const [customerQuery, setCustomerQuery] = useState('')
  /** When the cart was loaded from a quotation, checkout closes that quote. */
  const [loadedEstimateId, setLoadedEstimateId] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [changeMethodId, setChangeMethodId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null)
  const [menu, setMenu] = useState<
    'actions' | 'burger' | 'cash' | 'customer' | 'note' | 'close' | 'refund' | 'quotes' | 'transfer' | null
  >(null)
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null)
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({})
  const [cashKind, setCashKind] = useState<'IN' | 'OUT'>('OUT')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')
  const [closingCash, setClosingCash] = usePropState(props.cashSummary.expectedCash)
  const [pending, startTransition] = useTransition()
  const ready = useClientReady()
  const locked = useRegisterLocked(props.register.id)

  useEffect(() => {
    bookRef.current = book
  })

  useEffect(() => {
    if (!book || storedFor !== ticketKey) return
    savePosOrderBook(window.localStorage, props.cashierUserId, props.session.id, book)
  }, [book, storedFor, ticketKey, props.cashierUserId, props.session.id])

  function commitBook(recipe: (current: PosOrderBook) => PosOrderBook) {
    const base = bookRef.current ?? book ?? createPosOrderBook()
    const next = recipe(base)
    bookRef.current = next
    savePosOrderBook(window.localStorage, props.cashierUserId, props.session.id, next)
    setBook(next)
  }

  const active = book ? activePosOrder(book) : null
  const cart = active?.cart ?? EMPTY_CART
  const customerId = active?.customerId ?? null
  const note = active?.note ?? ''

  function setCart(updater: CartLine[] | ((prev: CartLine[]) => CartLine[])) {
    commitBook((current) => {
      const order = activePosOrder(current)
      const nextCart = typeof updater === 'function' ? updater(order.cart) : updater
      return patchPosOrder(current, order.id, { cart: nextCart })
    })
  }

  function setCustomerId(nextCustomerId: string | null) {
    commitBook((current) => patchPosOrder(current, activePosOrder(current).id, { customerId: nextCustomerId }))
  }

  function setNote(nextNote: string) {
    commitBook((current) => patchPosOrder(current, activePosOrder(current).id, { note: nextNote }))
  }

  function leavePayment() {
    setPayOpen(false)
    setAmounts({})
    setError(null)
  }

  function focusOrder(id: string) {
    if (pending) return
    leavePayment()
    commitBook((current) => selectPosOrder(current, id))
  }

  function openNewOrder() {
    if (pending) return
    leavePayment()
    setToast(null)
    commitBook((current) => addPosOrder(current))
  }

  function dismissOrder(id: string) {
    if (pending) return
    leavePayment()
    commitBook((current) => closePosOrder(current, id))
  }

  const cashMethod = useMemo(
    () => props.register.paymentMethods.find((method) => method.isCash) ?? null,
    [props.register.paymentMethods],
  )

  const customerName = useMemo(
    () => props.customers.find((row) => row.id === customerId)?.displayName ?? null,
    [customerId, props.customers],
  )
  const filteredCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase()
    if (!needle) return props.customers
    return props.customers.filter((customer) =>
      customer.displayName.toLowerCase().includes(needle),
    )
  }, [customerQuery, props.customers])

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
    if (!book) return
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
  }, [book, cart, customerName, props.currency, props.orgName, subtotal])

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
      const startPrice = (() => {
        const n = Number(product.price)
        return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : '0.00'
      })()
      return [
        ...prev,
        { itemId: product.id, name: product.name, price: startPrice, quantity: 1, storeId: null },
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

  function setPrice(itemId: string, price: string) {
    // Allow clearing while typing; only keep digits and one decimal point.
    const cleaned = price.replace(/[^\d.]/g, '')
    const parts = cleaned.split('.')
    const next =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, price: next } : line)))
  }

  function commitPrice(itemId: string, price: string) {
    const n = Number(price)
    const next = Number.isFinite(n) && n >= 0 ? n.toFixed(2) : '0.00'
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, price: next } : line)))
  }

  function cancelOrder() {
    const current = bookRef.current ? activePosOrder(bookRef.current) : null
    if (!current) return
    leavePayment()
    setLoadedEstimateId(null)
    setMenu(null)
    commitBook((book) => clearPosOrder(book, current.id))
    setToast(current.kind === 'register' ? 'Order cancelled' : `Order ${current.label} cancelled`)
  }

  function cartLinesPayload() {
    return cart.map((line) => ({
      itemId: line.itemId,
      quantity: String(line.quantity),
      unitPrice: line.price.trim() || undefined,
      storeId: line.storeId ?? undefined,
    }))
  }

  function saveQuotation() {
    setError(null)
    if (cart.length === 0) {
      setToast('Add products before saving a quotation.')
      return
    }
    startTransition(async () => {
      const result = await posCreateQuotation({
        registerId: props.register.id,
        customerId: customerId ?? undefined,
        note: note || null,
        lines: cartLinesPayload(),
      })
      if (!result.ok) {
        setError(result.error.message)
        setToast(result.error.message)
        return
      }
      setCart([])
      setNote('')
      setLoadedEstimateId(null)
      setMenu(null)
      setToast(`Quotation ${result.data.number} saved · ${formatMoney(result.data.total, props.currency)}`)
      router.refresh()
    })
  }

  function loadQuotation(estimateId: string) {
    setError(null)
    startTransition(async () => {
      const result = await posLoadQuotation({ estimateId })
      if (!result.ok) {
        setError(result.error.message)
        setToast(result.error.message)
        return
      }
      const quote = result.data
      setCart(
        quote.lines.map((line: CartLine) => ({
          itemId: line.itemId,
          name: line.name,
          price: line.price,
          quantity: line.quantity,
          storeId: line.storeId,
        })),
      )
      setCustomerId(quote.customerId)
      setNote(quote.note ?? '')
      setLoadedEstimateId(quote.id)
      setMenu(null)
      setToast(`Loaded ${quote.number} · pay when ready`)
    })
  }

  const paymentDecimals = minorUnits(props.currency)
  const changeChoices = useMemo(
    () =>
      changeReturnChoices({
        methods: props.register.paymentMethods,
        allowWalletChangeReturn: props.register.allowWalletChangeReturn,
        defaultMethodId: props.register.defaultChangeMethodId,
      }),
    [props.register.allowWalletChangeReturn, props.register.defaultChangeMethodId, props.register.paymentMethods],
  )
  const settlement = useMemo(
    () =>
      settlePosPayments({
        due: subtotal,
        methods: props.register.paymentMethods,
        amounts,
        decimals: paymentDecimals,
      }),
    [amounts, paymentDecimals, props.register.paymentMethods, subtotal],
  )
  const changeAccountError =
    Number(settlement.change) > 0 && !changeChoices.options.some((method) => method.id === changeMethodId)
      ? CHANGE_ACCOUNT_MESSAGE
      : null
  const paymentError = error ?? changeAccountError

  /**
   * Unpaid remainder after what's typed, straight from the settlement. Zero
   * once covered; otherwise a candidate for the small shortfall discount.
   */
  const shortfallPreview = useMemo(() => {
    const remaining = Number(settlement.remaining)
    if (remaining <= 0.009) return null
    if (remaining <= POS_SHORTFALL_DISCOUNT_MAX + 0.009) {
      return { status: 'discount' as const, amount: remaining }
    }
    return { status: 'short' as const, amount: remaining }
  }, [settlement.remaining])

  /** Settlement requires an exact match; a small shortfall becomes a discount instead. */
  const canCheckout =
    settlement.nonCashWithinBalance &&
    settlement.payments.length > 0 &&
    (settlement.canValidate || shortfallPreview?.status === 'discount')

  const canValidatePayment = paymentCanValidate({
    canSettle: canCheckout,
    blockingError: paymentError,
    change: settlement.change,
    changeMethodId,
    allowedChangeMethodIds: changeChoices.options.map((method) => method.id),
  })

  function openPay() {
    if (cart.length === 0) return
    const onTill = props.register.paymentMethods.some((method) => method.id === props.usualPaymentMethodId)
    const methodId = onTill
      ? (props.usualPaymentMethodId ?? null)
      : (cashMethod?.id ?? props.register.paymentMethods[0]?.id ?? null)
    // One field gets the amount due. The cashier can clear it and split the rest.
    setAmounts(prefilledPaymentAmounts({ due: subtotal, methodId, decimals: paymentDecimals }))
    setChangeMethodId(changeChoices.defaultId)
    setError(null)
    setPayOpen(true)
  }

  function setMethodAmount(method: { id: string; isCash: boolean }, raw: string) {
    const next = clampPaymentDraft({
      due: subtotal,
      method,
      raw,
      methods: props.register.paymentMethods,
      amounts,
      decimals: paymentDecimals,
    })
    if (!next) return
    setAmounts((prev) => ({ ...prev, [method.id]: next.value }))
    // An empty wallet after cash already covers the sale is not an overpayment.
    setError(nonCashDraftError(next.clamped, next.value))
  }

  function fillMethod(methodId: string) {
    const amount = exactRemainingAmount({
      due: subtotal,
      methodId,
      amounts,
      decimals: paymentDecimals,
    })
    setAmounts((prev) => ({ ...prev, [methodId]: amount }))
    setError(null)
  }

  function completeSale() {
    if (!canValidatePayment) {
      setError(
        paymentError ??
          (!settlement.nonCashWithinBalance
            ? 'Non-cash payments cannot exceed the remaining balance.'
            : shortfallPreview?.status === 'short'
              ? `Payment is short by ${formatMoney(shortfallPreview.amount, props.currency)} (max discount ${formatMoney(POS_SHORTFALL_DISCOUNT_MAX, props.currency)}).`
              : 'Enter payments that cover the amount due.'),
      )
      return
    }
    setError(null)

    // Change is only known here; the receipt shows it on the first print.
    const changeAtSale = Number(settlement.change)
    const payments = settlement.tenders
    const selling = bookRef.current ? activePosOrder(bookRef.current) : null
    if (!selling || selling.cart.length === 0) return
    const lines = cartLinesPayload()
    const estimateId = loadedEstimateId ?? undefined
    startTransition(async () => {
      // The signed-in user is whoever the server action sees. The sale is
      // posted on this open session, the same way a single-cart checkout was.
      const result = await posCheckout({
        registerId: props.register.id,
        sessionId: props.session.id,
        customerId: selling.customerId ?? undefined,
        note: selling.note || null,
        lines,
        payments,
        estimateId,
        ...(changeAtSale > 0.004 ? { changeMethodId } : {}),
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      leavePayment()
      commitBook((current) => settlePosOrder(current, selling.id))
      setLoadedEstimateId(null)
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

  if (!ready || !book || !active) return null

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
        <div className="flex max-w-full items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => focusOrder((book.orders.find((order) => order.kind === 'register') ?? book.orders[0]!).id)}
            aria-pressed={active.kind === 'register'}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={orderTabStyle(active.kind === 'register', dark, border, text)}
          >
            Register
          </button>
          <Link
            href="/pos/orders"
            className="rounded-md px-3 py-1.5 text-sm"
            style={{ border: `1px solid ${border}`, color: text }}
          >
            Orders
          </Link>
          {props.canQuote ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMenu('quotes')
              }}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${border}`, color: text }}
            >
              Quotations
            </button>
          ) : null}
          <button
            type="button"
            onClick={openNewOrder}
            disabled={book.orders.length >= POS_OPEN_ORDER_LIMIT || pending}
            className="inline-flex size-8 items-center justify-center rounded-md disabled:opacity-40"
            style={{ border: `1px solid ${border}` }}
            title="New order"
            aria-label="New order"
          >
            <PlusIcon className="size-4" />
          </button>
          {book.orders
            .filter((order) => order.kind === 'order')
            .map((order) => {
              const selected = order.id === active.id
              const customer = props.customers.find((row) => row.id === order.customerId)?.displayName
              return (
                <span
                  key={order.id}
                  className="inline-flex items-center rounded-md"
                  style={orderTabStyle(selected, dark, border, text)}
                >
                  <button
                    type="button"
                    onClick={() => focusOrder(order.id)}
                    aria-pressed={selected}
                    title={customer ? `${order.label} · ${customer}` : `Order ${order.label}`}
                    className="px-2.5 py-1.5 text-sm font-semibold tabular"
                  >
                    {order.label}
                  </button>
                  {posOrderIsEmpty(order) ? (
                    <button
                      type="button"
                      onClick={() => dismissOrder(order.id)}
                      aria-label={`Close order ${order.label}`}
                      title="Close empty order"
                      className="pr-1.5"
                    >
                      <XIcon className="size-3.5 opacity-70" />
                    </button>
                  ) : null}
                </span>
              )
            })}
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
          {props.tillBalance ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMenu('transfer')
              }}
              className="hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline"
              style={{ background: `${ODOO.teal}22`, color: dark ? '#9fe0e3' : ODOO.tealDark }}
            >
              Till {props.tillBalance.balance}
            </button>
          ) : null}
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
            <p className="mb-1 text-xs font-medium" style={{ color: muted }} data-active-order={active.label}>
              {active.kind === 'register' ? 'Register' : `Order ${active.label}`}
              {customerName ? ` · ${customerName}` : ''}
            </p>
            <div className="mb-3 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{formatMoney(subtotal, props.currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCustomerQuery('')
                  setMenu('customer')
                }}
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
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <label className="inline-flex items-center gap-1" style={{ color: muted }}>
                      <span className="shrink-0">Price</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.price}
                        onChange={(event) => setPrice(line.itemId, event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={() => commitPrice(line.itemId, line.price)}
                        className="w-[5.25rem] rounded-md border px-1.5 py-1 text-sm font-semibold tabular outline-none focus:ring-2"
                        style={{
                          borderColor: border,
                          background: dark ? '#1f1f23' : '#ffffff',
                          color: text,
                          // Make the editable price obvious on the dark till.
                          boxShadow: dark ? 'inset 0 0 0 1px rgba(255,255,255,0.06)' : undefined,
                        }}
                        aria-label={`Edit price for ${line.name}`}
                        title="Tap to raise or lower the price for this sale"
                      />
                    </label>
                    <span style={{ color: muted }}>·</span>
                    <span className="font-medium tabular" style={{ color: text }}>
                      {formatMoney(Number(line.price) * line.quantity || 0, props.currency)}
                    </span>
                  </div>
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
                <label className="flex flex-col items-center gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide" style={{ color: muted }}>
                    Qty
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(event) => setQty(line.itemId, Number(event.target.value))}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-14 rounded-md border px-1 py-1 text-center text-sm font-semibold outline-none focus:ring-2"
                    style={{
                      borderColor: border,
                      background: dark ? '#1f1f23' : '#ffffff',
                      color: text,
                    }}
                    aria-label={`Quantity for ${line.name}`}
                  />
                </label>
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
            {props.canCreateQuote ? (
              <ActionTile
                label="Save Quotation"
                icon={<FileTextIcon className="size-6" />}
                onClick={saveQuotation}
                dark={dark}
              />
            ) : null}
            {props.canQuote ? (
              <ActionTile
                label="Open Quotations"
                icon={<Link2Icon className="size-6" />}
                onClick={() => {
                  setError(null)
                  setMenu('quotes')
                }}
                dark={dark}
              />
            ) : null}
            <ActionTile
              label="Edit prices"
              icon={<ListIcon className="size-6" />}
              onClick={() => {
                setToast('Tap Price on a cart line to raise or lower it for this sale only.')
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
                writeBrowserStore(THEME_KEY, dark ? 'light' : 'dark')
                setMenu(null)
              }}
              dark={dark}
            />
            <ActionTile
              label="Transfer out"
              icon={<ArrowRightLeftIcon className="size-6" />}
              onClick={() => {
                setError(null)
                setMenu('transfer')
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

      {menu === 'transfer' && props.tillBalance ? (
        <Modal title="Transfer out" dark={dark} onClose={() => setMenu(null)}>
          <RegisterTransferForm
            registerId={props.register.id}
            balance={props.tillBalance.balance}
            balanceRaw={props.tillBalance.balanceRaw}
            currency={props.currency}
            destinations={props.transferDestinations ?? []}
            dark={dark}
            onDone={(message) => {
              setMenu(null)
              setToast(message)
            }}
          />
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
        <Modal
          title="Customer"
          dark={dark}
          onClose={() => {
            setCustomerQuery('')
            setMenu(null)
          }}
        >
          <label className="mb-2 flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: border, background: chip }}>
            <SearchIcon className="size-4 shrink-0 opacity-60" aria-hidden />
            <input
              type="search"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Search customer by name…"
              autoFocus
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: text }}
            />
          </label>
          <button
            type="button"
            className="mb-2 w-full rounded-lg px-3 py-2 text-left text-sm"
            style={{ background: chip }}
            onClick={() => {
              setCustomerId(null)
              setCustomerQuery('')
              setMenu(null)
            }}
          >
            Walk-in (register default)
          </button>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {filteredCustomers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-90"
                  style={{ background: customerId === customer.id ? `${ODOO.purple}44` : chip }}
                  onClick={() => {
                    setCustomerId(customer.id)
                    setCustomerQuery('')
                    setMenu(null)
                  }}
                >
                  {customer.displayName}
                </button>
              </li>
            ))}
            {filteredCustomers.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm opacity-60">No customer matches that name.</li>
            ) : null}
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

      {menu === 'quotes' ? (
        <Modal title="Quotations" dark={dark} onClose={() => setMenu(null)}>
          <p className="mb-3 text-sm" style={{ color: muted }}>
            Save the cart as a quotation, or load one when the customer returns — then Pay to sell.
          </p>
          {props.canCreateQuote && cart.length > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={saveQuotation}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: ODOO.purple }}
            >
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save current cart as quotation
            </button>
          ) : null}
          {loadedEstimateId ? (
            <p className="mb-3 rounded-md px-3 py-2 text-xs" style={{ background: chip, color: muted }}>
              Cart loaded from a quotation — Pay will close that quotation.
            </p>
          ) : null}
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {(props.openQuotations ?? []).map((quote) => (
              <li
                key={quote.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: chip }}
              >
                <div className="min-w-0">
                  <p className="font-medium">{quote.number}</p>
                  <p className="text-xs" style={{ color: muted }}>
                    {quote.customerName} · {quote.dateLabel} · {quote.lineCount} line
                    {quote.lineCount === 1 ? '' : 's'} · {quote.totalLabel}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => loadQuotation(quote.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: ODOO.teal }}
                >
                  Load
                </button>
              </li>
            ))}
            {(props.openQuotations ?? []).length === 0 ? (
              <li className="py-8 text-center text-sm" style={{ color: muted }}>
                No open quotations. Add products and save a quotation from Actions.
              </li>
            ) : null}
          </ul>
          {error && menu === 'quotes' ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Link
              href="/pos/quotations"
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${border}` }}
            >
              All quotations
            </Link>
            <button
              type="button"
              onClick={() => setMenu(null)}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${border}` }}
            >
              Close
            </button>
          </div>
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
          <PosPaymentForm
            due={subtotal}
            currency={props.currency}
            methods={props.register.paymentMethods}
            amounts={amounts}
            paid={settlement.paid}
            remaining={settlement.remaining}
            change={settlement.change}
            canValidate={canValidatePayment}
            pending={pending}
            error={paymentError}
            dark={dark}
            changeMethods={changeChoices.options}
            changeMethodId={changeMethodId}
            onChangeMethod={(methodId) => {
              setChangeMethodId(methodId)
              setError(null)
            }}
            note={
              shortfallPreview?.status === 'discount' ? (
                <p className="text-sm" style={{ color: ODOO.teal }}>
                  Shortfall {formatMoney(shortfallPreview.amount, props.currency)} will be a discount
                  on the receipt (max {formatMoney(POS_SHORTFALL_DISCOUNT_MAX, props.currency)}).
                </p>
              ) : null
            }
            onAmount={setMethodAmount}
            onFill={fillMethod}
            onCancel={() => setPayOpen(false)}
            onValidate={completeSale}
          />
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
