import { isCalendarDate, type CalendarDate } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset, type DatePreset } from '@/lib/list-filters'
import { money, ZERO, type Money } from '@/lib/money'

/**
 * Unfiltered, the orders page stays the newest 80 receipts. A date, register,
 * or wallet filter raises the cap so a salesman can total a whole day.
 */
export const POS_ORDERS_DEFAULT_LIMIT = 80
export const POS_ORDERS_FILTERED_LIMIT = 2000

export type PosOrderListFilters = {
  from?: CalendarDate
  to?: CalendarDate
  registerId?: string
  paymentMethodId?: string
}

export type PosOrderReportQuery = PosOrderListFilters & {
  /** Highlighted quick range. `custom` when the from/to boxes don't match one. */
  preset: DatePreset | 'custom'
}

export type PosOrderSummaryPayment = {
  methodId: string
  methodName: string
  sortOrder: number
  /** Stored positive. Refunds flip the sign via `refund`. */
  amount: string
  refund: boolean
}

export type PosOrderSummaryInput = {
  payments: PosOrderSummaryPayment[]
}

export type PosMethodCatalogItem = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type PosWalletTotal = {
  methodId: string
  name: string
  sortOrder: number
  amount: Money
}

function first(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

function cleanId(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 80) return undefined
  return trimmed
}

function matchingPreset(
  from: CalendarDate | undefined,
  to: CalendarDate | undefined,
  asOf: CalendarDate,
): DatePreset | 'custom' {
  if (!from || !to) return 'custom'
  for (const option of DATE_PRESETS) {
    if (!option.value) continue
    const range = presetRange(option.value, asOf)
    if (range && range.from === from && range.to === to) return option.value
  }
  return 'custom'
}

/**
 * Read the orders-report query string.
 *
 * Explicit from/to win over a preset, so submitting the date boxes keeps the
 * range the salesman is looking at. A preset link omits from/to.
 */
export function readPosOrderReportQuery(
  search: Record<string, string | string[] | undefined>,
  asOf: CalendarDate,
): PosOrderReportQuery {
  const registerId = cleanId(first(search.register))
  const paymentMethodId = cleanId(first(search.method))

  const fromRaw = first(search.from)
  const toRaw = first(search.to)
  let from = fromRaw && isCalendarDate(fromRaw) ? fromRaw : undefined
  let to = toRaw && isCalendarDate(toRaw) ? toRaw : undefined

  if (from || to) {
    if (from && to && from > to) {
      const swap = from
      from = to
      to = swap
    }
    return {
      preset: matchingPreset(from, to, asOf),
      from,
      to,
      registerId,
      paymentMethodId,
    }
  }

  const preset = readDatePreset(first(search.date))
  const range = presetRange(preset, asOf)
  return {
    preset,
    from: range?.from,
    to: range?.to,
    registerId,
    paymentMethodId,
  }
}

export function posOrderListLimit(filters: PosOrderListFilters): number {
  if (filters.from || filters.to || filters.registerId || filters.paymentMethodId) {
    return POS_ORDERS_FILTERED_LIMIT
  }
  return POS_ORDERS_DEFAULT_LIMIT
}

/** Params a preset chip should keep. From/to are left off so the preset applies. */
export function posOrderPresetParams(
  query: PosOrderReportQuery,
  preset: string,
): Record<string, string | undefined> {
  return {
    date: preset || undefined,
    register: query.registerId,
    method: query.paymentMethodId,
  }
}

/**
 * Money received per wallet for the orders currently on screen.
 *
 * A split sale adds each line to its own wallet: EDAHAB 88 $10 + EVC 88 $15
 * adds $10 to EDAHAB 88 and $15 to EVC 88. Refund receipts subtract. Active
 * wallets with no movement stay at zero so a salesman can see that a wallet
 * took nothing that day. The grand total is the sum of those wallet amounts.
 */
export function summarizePosWallets(
  orders: PosOrderSummaryInput[],
  methods: PosMethodCatalogItem[],
): { wallets: PosWalletTotal[]; total: Money; orderCount: number } {
  const catalog = new Map(methods.map((method) => [method.id, method]))
  const byId = new Map<string, PosWalletTotal>()

  for (const method of methods) {
    if (!method.isActive) continue
    byId.set(method.id, {
      methodId: method.id,
      name: method.name,
      sortOrder: method.sortOrder,
      amount: ZERO,
    })
  }

  for (const order of orders) {
    for (const payment of order.payments) {
      const signed = payment.refund ? money(payment.amount).negated() : money(payment.amount)
      const known = catalog.get(payment.methodId)
      const existing = byId.get(payment.methodId)
      if (existing) {
        existing.amount = existing.amount.plus(signed)
      } else {
        byId.set(payment.methodId, {
          methodId: payment.methodId,
          name: known?.name || payment.methodName,
          sortOrder: known?.sortOrder ?? payment.sortOrder,
          amount: signed,
        })
      }
    }
  }

  const wallets = [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  )
  const total = wallets.reduce((sum, wallet) => sum.plus(wallet.amount), ZERO)
  return { wallets, total, orderCount: orders.length }
}
