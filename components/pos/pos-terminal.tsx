'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2Icon, LockIcon, SearchIcon, SettingsIcon, Trash2Icon } from 'lucide-react'

import { posCheckout } from '@/app/(app)/pos/actions'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { RegisterLock, useClientReady, useRegisterLocked, writeRegisterLocked } from '@/components/pos/register-lock'

type Product = {
  id: string
  name: string
  sku: string | null
  category: string | null
  price: string
}

type PaymentMethod = {
  id: string
  name: string
}

type CartLine = {
  itemId: string
  name: string
  price: string
  quantity: number
}

export function PosTerminal(props: {
  register: { id: string; name: string; paymentMethods: PaymentMethod[] }
  products: Product[]
  currency: string
  orgName: string
}) {
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ready = useClientReady()
  const locked = useRegisterLocked(props.register.id)

  function lockRegister() {
    writeRegisterLocked(props.register.id, true)
  }

  function unlockRegister() {
    writeRegisterLocked(props.register.id, false)
  }

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

  const subtotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0)
  }, [cart])

  function addProduct(product: Product) {
    setSuccess(null)
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === product.id)
      if (existing) {
        return prev.map((line) =>
          line.itemId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [
        ...prev,
        { itemId: product.id, name: product.name, price: product.price, quantity: 1 },
      ]
    })
  }

  function setQty(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((line) => line.itemId !== itemId))
      return
    }
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)))
  }

  function openPay() {
    if (cart.length === 0) return
    const first = props.register.paymentMethods[0]
    setAmounts(first ? { [first.id]: subtotal.toFixed(2) } : {})
    setError(null)
    setPayOpen(true)
  }

  const paymentSum = useMemo(() => {
    return Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0)
  }, [amounts])

  function fillRemaining(methodId: string) {
    const others = Object.entries(amounts)
      .filter(([id]) => id !== methodId)
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
    const remaining = Math.max(0, subtotal - others)
    setAmounts((prev) => ({ ...prev, [methodId]: remaining.toFixed(2) }))
  }

  function completeSale() {
    setError(null)
    const payments = props.register.paymentMethods
      .map((method) => ({
        paymentMethodId: method.id,
        amount: amounts[method.id]?.trim() ?? '',
      }))
      .filter((payment) => payment.amount && Number(payment.amount) > 0)

    if (payments.length === 0) {
      setError('Enter at least one payment amount.')
      return
    }
    if (Math.abs(paymentSum - subtotal) > 0.009) {
      setError('Payment amounts must equal the total.')
      return
    }

    startTransition(async () => {
      const result = await posCheckout({
        registerId: props.register.id,
        lines: cart.map((line) => ({
          itemId: line.itemId,
          quantity: String(line.quantity),
        })),
        payments,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setPayOpen(false)
      setCart([])
      setAmounts({})
      setSuccess(`Receipt ${result.data.number} · ${formatMoney(result.data.total, props.currency)}`)
    })
  }

  if (!ready) return null

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#f5f5f5]">
      <header className="flex items-center justify-between gap-4 bg-[#714B67] px-4 py-3 text-white shadow-md">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/80">Point of Sale</p>
          <h1 className="text-lg font-semibold">{props.register.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={lockRegister}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          >
            <LockIcon className="size-4" />
            Lock
          </button>
          <Link
            href="/pos/settings"
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          >
            <SettingsIcon className="size-4" />
            Settings
          </Link>
          <Link href="/pos" className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
            Registers
          </Link>
        </div>
      </header>

      {success ? (
        <div className="mx-4 mt-3 rounded-md border border-[#017e84]/30 bg-[#017e84]/10 px-4 py-2 text-sm text-[#017e84]">
          {success}
        </div>
      ) : null}

      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col border-r border-black/5 p-4">
          <div className="relative mb-4 max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search products…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm shadow-sm"
            />
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="flex flex-col rounded-lg border border-black/5 bg-white p-3 text-left shadow-sm transition hover:border-[#714B67]/40 hover:shadow-md"
              >
                <span className="line-clamp-2 text-sm font-medium text-[#2d2d2d]">{product.name}</span>
                {product.category ? (
                  <span className="mt-1 text-xs text-muted-foreground">{product.category}</span>
                ) : null}
                <span className="mt-auto pt-2 text-sm font-semibold text-[#017e84]">
                  {formatMoney(product.price, props.currency)}
                </span>
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">
                No products for POS. Turn on &quot;Available in POS&quot; on items and set a sales price.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="flex flex-col bg-white p-4 shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#714B67]">Cart</h2>
          <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {cart.map((line) => (
              <li key={line.itemId} className="flex gap-2 rounded-md border border-black/5 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(line.price, props.currency)} each
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(event) => setQty(line.itemId, Number(event.target.value))}
                  className="w-14 rounded border px-1 py-0.5 text-center"
                />
                <button
                  type="button"
                  onClick={() => setQty(line.itemId, 0)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </li>
            ))}
            {cart.length === 0 ? (
              <li className="text-sm text-muted-foreground">Tap a product to add it.</li>
            ) : null}
          </ul>
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(subtotal, props.currency)}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || pending}
              onClick={openPay}
              className={cn(
                'mt-3 w-full rounded-lg py-3 text-sm font-semibold text-white',
                cart.length === 0 ? 'cursor-not-allowed bg-black/20' : 'bg-[#017e84] hover:bg-[#016970]',
              )}
            >
              Payment
            </button>
          </div>
        </aside>
      </div>

      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#714B67]">Split payment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lacagta u qaybi hababka aad dooratay (EVC, Edahab, Premier, My Cash, iwm). Akoon kasta wuxuu
              ku dhacayaa xisaabtiisa.
            </p>
            <p className="mt-3 text-xl font-semibold">{formatMoney(subtotal, props.currency)}</p>
            <ul className="mt-4 space-y-3">
              {props.register.paymentMethods.map((method) => (
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
                    className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => fillRemaining(method.id)}
                    className="text-xs text-[#017e84] hover:underline"
                  >
                    Remaining
                  </button>
                </li>
              ))}
            </ul>
            <p
              className={cn(
                'mt-2 text-sm',
                Math.abs(paymentSum - subtotal) < 0.01 ? 'text-[#017e84]' : 'text-destructive',
              )}
            >
              Paid: {formatMoney(paymentSum, props.currency)}
            </p>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={completeSale}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-[#714B67] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c3d55]"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Validate
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {locked ? <RegisterLock orgName={props.orgName} onUnlock={unlockRegister} /> : null}
    </div>
  )
}
