import { Decimal } from 'decimal.js'

import { round, toMoneyString, ZERO, type Money } from './money'
import {
  NON_CASH_OVERPAY_MESSAGE,
  settlePosPayments,
  type PosPayMethod,
  type SettledPosPayment,
} from './pos-payment'

export const CHANGE_ACCOUNT_MESSAGE = 'Choose an account to return the change from.'
export const CHANGE_NOT_ALLOWED_MESSAGE = 'Change cannot be returned from that account.'
export const WALLET_CHANGE_OFF_MESSAGE = 'Change cannot be returned from a wallet.'
export const POSITIVE_PAYMENT_MESSAGE = 'Each payment must be a positive amount.'
export const UNKNOWN_METHOD_MESSAGE = 'One of the payment methods is not allowed on this register.'
export const DUPLICATE_METHOD_MESSAGE = 'Each payment method can only be entered once.'
export const COVER_DUE_MESSAGE = 'Enter payments that cover the amount due.'
export const TOTAL_MISMATCH_MESSAGE = 'Payments must equal the sale total.'

export type ChangeMethod = PosPayMethod & {
  name: string
  /** Method flag and till flag, already combined. */
  allowsChangeReturn: boolean
}

export type ChangeChoice = { id: string; name: string; isCash: boolean }

/**
 * Accounts the Payment dialog may hand change back from, and which one is selected
 * when the dialog opens. Cash is the fallback when the saved default is missing
 * or no longer allowed. Wallets drop out when the till has switched them off.
 */
export function changeReturnChoices(input: {
  methods: ChangeMethod[]
  allowWalletChangeReturn: boolean
  defaultMethodId?: string | null
}): { options: ChangeChoice[]; defaultId: string } {
  const options = input.methods
    .filter((method) => method.allowsChangeReturn)
    .filter((method) => method.isCash || input.allowWalletChangeReturn)
    .map((method) => ({ id: method.id, name: method.name, isCash: method.isCash }))

  const saved = input.defaultMethodId
  const defaultId =
    (saved && options.some((option) => option.id === saved) ? saved : null) ??
    options.find((option) => option.isCash)?.id ??
    options[0]?.id ??
    ''

  return { options, defaultId }
}

/** Validate stays disabled while a validation message is up, or change has nowhere to go. */
export function paymentCanValidate(input: {
  canSettle: boolean
  /** Any validation message currently shown in the dialog. */
  blockingError: string | null
  change: string
  changeMethodId: string
  allowedChangeMethodIds: string[]
}): boolean {
  if (input.blockingError) return false
  if (!input.canSettle) return false
  if (Number(input.change) > 0.0001) {
    if (!input.changeMethodId) return false
    if (!input.allowedChangeMethodIds.includes(input.changeMethodId)) return false
  }
  return true
}

export type ResolvedTender = {
  /** Gross amounts to debit — what the customer handed over. */
  tenders: SettledPosPayment[]
  /** Net amounts the sale kept. They add up to the amount due. */
  payments: SettledPosPayment[]
  change: string
  changeMethodId: string | null
}

export type TenderResult = { ok: true; tender: ResolvedTender } | { ok: false; message: string }

const DEFAULT_DECIMALS = 2

function scaleOf(decimals: number | undefined): number {
  if (decimals == null || !Number.isInteger(decimals) || decimals < 0 || decimals > 4) return DEFAULT_DECIMALS
  return decimals
}

/**
 * Check a checkout the server was handed. Amounts are what the customer tendered,
 * not the net the sale kept. Change is computed here — a client-supplied change
 * figure is never trusted.
 */
export function resolvePosTender(input: {
  due: Decimal.Value
  methods: ChangeMethod[]
  payments: { paymentMethodId: string; amount: string }[]
  changeMethodId?: string | null
  allowWalletChangeReturn: boolean
  decimals?: number
}): TenderResult {
  const decimals = scaleOf(input.decimals)
  const due = round(input.due, decimals)
  if (!due.gt(0)) return { ok: false, message: COVER_DUE_MESSAGE }

  const byId = new Map(input.methods.map((method) => [method.id, method]))
  const seen = new Set<string>()
  const amounts: Record<string, string> = {}

  for (const payment of input.payments) {
    const method = byId.get(payment.paymentMethodId)
    if (!method) return { ok: false, message: UNKNOWN_METHOD_MESSAGE }
    if (seen.has(payment.paymentMethodId)) return { ok: false, message: DUPLICATE_METHOD_MESSAGE }
    seen.add(payment.paymentMethodId)

    let amount: Decimal
    try {
      amount = new Decimal(payment.amount.trim())
    } catch {
      return { ok: false, message: POSITIVE_PAYMENT_MESSAGE }
    }
    if (!amount.isFinite() || amount.isNegative() || amount.isZero()) {
      return { ok: false, message: POSITIVE_PAYMENT_MESSAGE }
    }
    amounts[payment.paymentMethodId] = payment.amount.trim()
  }

  const settlement = settlePosPayments({
    due,
    methods: input.methods,
    amounts,
    decimals,
  })

  if (!settlement.nonCashWithinBalance) return { ok: false, message: NON_CASH_OVERPAY_MESSAGE }
  if (!settlement.canValidate) return { ok: false, message: COVER_DUE_MESSAGE }

  const net = settlement.payments.reduce((total, payment) => total.plus(payment.amount), ZERO)
  if (!net.eq(due)) return { ok: false, message: TOTAL_MISMATCH_MESSAGE }

  const change = round(settlement.change, decimals)
  if (change.isZero()) {
    return {
      ok: true,
      tender: { tenders: settlement.tenders, payments: settlement.payments, change: change.toFixed(decimals), changeMethodId: null },
    }
  }

  const changeMethodId = input.changeMethodId?.trim() || ''
  if (!changeMethodId) return { ok: false, message: CHANGE_ACCOUNT_MESSAGE }
  const changeMethod = byId.get(changeMethodId)
  if (!changeMethod) return { ok: false, message: CHANGE_NOT_ALLOWED_MESSAGE }
  const allowed = changeReturnChoices({
    methods: input.methods,
    allowWalletChangeReturn: input.allowWalletChangeReturn,
    defaultMethodId: changeMethodId,
  })
  if (!allowed.options.some((option) => option.id === changeMethodId)) {
    if (!changeMethod.isCash && !input.allowWalletChangeReturn) {
      return { ok: false, message: WALLET_CHANGE_OFF_MESSAGE }
    }
    return { ok: false, message: CHANGE_NOT_ALLOWED_MESSAGE }
  }

  return {
    ok: true,
    tender: {
      tenders: settlement.tenders,
      payments: settlement.payments,
      change: change.toFixed(decimals),
      changeMethodId,
    },
  }
}

export type PosSaleTender = {
  payments: { methodId: string; methodName: string; accountId: string; amount: string }[]
  changeAmount: string
  changeMethodId: string | null
  changeMethodName: string | null
  changeAccountId: string | null
}

export type AccountTenderTotal = {
  accountId: string
  methodName: string
  tendered: string
  change: string
  net: string
}

type Bucket = { accountId: string; methodName: string; tendered: Money; change: Money }

/**
 * Tendered in, change out, and the net each account kept.
 * A sale with no change account (older rows) treats each payment as both the
 * tender and the net. Change from an account that took nothing is a negative net.
 */
export function accountTenderTotals(sales: PosSaleTender[], decimals = 2): AccountTenderTotal[] {
  const buckets = new Map<string, Bucket>()

  const bucket = (accountId: string, methodName: string) => {
    const key = accountId || methodName
    const current = buckets.get(key)
    if (current) return current
    const created = { accountId: accountId || key, methodName, tendered: ZERO, change: ZERO }
    buckets.set(key, created)
    return created
  }

  for (const sale of sales) {
    for (const payment of sale.payments) {
      const amount = round(payment.amount || 0, decimals)
      if (amount.isZero()) continue
      const row = bucket(payment.accountId, payment.methodName)
      row.tendered = row.tendered.plus(amount)
    }
    const change = round(sale.changeAmount || 0, decimals)
    if (change.gt(0) && (sale.changeAccountId || sale.changeMethodName)) {
      const row = bucket(sale.changeAccountId || sale.changeMethodId || sale.changeMethodName || 'change', sale.changeMethodName || 'Change')
      row.change = row.change.plus(change)
    }
  }

  return [...buckets.values()]
    .map((row) => ({
      accountId: row.accountId,
      methodName: row.methodName,
      tendered: toMoneyString(row.tendered, decimals),
      change: toMoneyString(row.change, decimals),
      net: toMoneyString(row.tendered.minus(row.change), decimals),
    }))
    .sort((a, b) => a.methodName.localeCompare(b.methodName))
}

/** "EVC 88 13.00", or null when this sale handed nothing back. */
export function saleChangeLabel(sale: PosSaleTender, decimals = 2): string | null {
  const change = round(sale.changeAmount || 0, decimals)
  if (!change.gt(0)) return null
  const name = sale.changeMethodName || 'Change'
  return `${name} ${toMoneyString(change, decimals)}`
}

/**
 * What the cash drawer should move by for one order.
 * Change returned from cash leaves the drawer. Change returned from a wallet does not.
 * Older sales store the net cash the sale kept and a zero change, which is the same movement.
 */
export function drawerCashMovement(input: {
  kind: 'SALE' | 'REFUND'
  payments: { isCash: boolean; amount: string }[]
  changeAmount: string
  changeIsCash: boolean
}): { sales: Money; refunds: Money } {
  let cash = ZERO
  for (const payment of input.payments) {
    if (!payment.isCash) continue
    const amount = new Decimal(payment.amount || 0)
    if (amount.gt(0)) cash = cash.plus(amount)
  }
  if (input.changeIsCash) {
    const change = new Decimal(input.changeAmount || 0)
    if (change.gt(0)) cash = cash.minus(change)
  }
  if (input.kind === 'REFUND') return { sales: ZERO, refunds: cash }
  return { sales: cash, refunds: ZERO }
}
