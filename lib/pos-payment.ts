import { Decimal } from 'decimal.js'

import { round, ZERO, type Money } from './money'

export type PosPayMethod = { id: string; isCash: boolean }

/** Cash is the method whose name is cash, not a wallet that happens to contain the letters. */
export function isCashMethodName(name: string) {
  return /\bcash\b/i.test(name.trim())
}

export type SettledPosPayment = { paymentMethodId: string; amount: string }

/** Shown when a non-cash amount that is still in the field passes what is left. */
export const NON_CASH_OVERPAY_MESSAGE = 'Non-cash payments cannot exceed the remaining balance.'

export type PosPaymentSettlement = {
  /** What the customer handed over or transferred, including cash that comes back as change. */
  paid: string
  /** Amount due that the entered payments do not yet cover. */
  remaining: string
  /** Cash given beyond what the sale still needed. A wallet or card line never produces this. */
  change: string
  /** Every non-cash line stays within the amount due. */
  nonCashWithinBalance: boolean
  /** Validate may be pressed: the sale is covered and the lines to save add up to it. */
  canValidate: boolean
  /**
   * Lines the sale took. Cash is the amount the sale kept, not the notes handed over.
   * Methods left blank are omitted. These add up to the amount due.
   */
  payments: SettledPosPayment[]
  /**
   * What was actually handed over or transferred, including cash that comes back
   * as change. This is what the ledger debits.
   */
  tenders: SettledPosPayment[]
}

const DEFAULT_DECIMALS = 2

function scaleOf(decimals: number | undefined): number {
  if (decimals == null || !Number.isInteger(decimals) || decimals < 0 || decimals > 4) return DEFAULT_DECIMALS
  return decimals
}

function quantize(value: Decimal.Value, decimals: number): Money {
  return round(value, decimals)
}

function format(value: Decimal.Value, decimals: number): string {
  return quantize(value, decimals).toFixed(decimals)
}

/** Empty, zero, and unfinished drafts count as nothing. Anything unparsable does too. */
function parseEntered(raw: string | undefined, decimals: number): Money {
  if (raw == null) return ZERO
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '.') return ZERO
  let value: Decimal
  try {
    value = new Decimal(trimmed)
  } catch {
    return ZERO
  }
  if (!value.isFinite() || value.lte(0)) return ZERO
  return quantize(value, decimals)
}

type EnteredLine = PosPayMethod & { amount: Money }

function enteredLines(
  methods: PosPayMethod[],
  amounts: Record<string, string | undefined>,
  decimals: number,
): EnteredLine[] {
  return methods.map((method) => ({
    ...method,
    amount: parseEntered(amounts[method.id], decimals),
  }))
}

/**
 * Balance still owed after every other line already typed, cash included.
 * A non-cash method cannot take more than this: only cash may run past it,
 * and that excess is change rather than another payment.
 */
function nonCashRoom(due: Money, lines: EnteredLine[], exceptId: string): Money {
  let others = ZERO
  for (const line of lines) {
    if (line.id === exceptId) continue
    others = others.plus(line.amount)
  }
  const room = due.minus(others)
  return room.gt(0) ? room : ZERO
}

/**
 * Split a tender across the sale.
 *
 * No method is assumed. An empty field — including cash — is zero, so a wallet
 * payment is never stacked on top of a cash tender the cashier did not type.
 * Non-cash lines cannot, together, pass the amount due: that money is not
 * handed back. While a non-cash amount is being typed it also cannot pass the
 * balance still owed after the cash already entered. Cash may pass what is
 * still owed; the extra is change and stays off the sale. Saved lines are only
 * the methods with an amount above zero, and they add up to the amount due.
 */
export function settlePosPayments(input: {
  due: Decimal.Value
  methods: PosPayMethod[]
  amounts: Record<string, string | undefined>
  /** Currency minor units. Defaults to 2. */
  decimals?: number
}): PosPaymentSettlement {
  const decimals = scaleOf(input.decimals)
  const due = quantize(input.due, decimals)
  const lines = enteredLines(input.methods, input.amounts, decimals)

  let nonCash = ZERO
  let cashTendered = ZERO
  for (const line of lines) {
    if (line.isCash) cashTendered = cashTendered.plus(line.amount)
    else nonCash = nonCash.plus(line.amount)
  }

  const nonCashWithinBalance = nonCash.lte(due)
  // Cash covers whatever the other methods did not. Anything beyond that is change.
  const cashNeeded = nonCash.gte(due) ? ZERO : due.minus(nonCash)
  const change = nonCashWithinBalance && cashTendered.gt(cashNeeded) ? cashTendered.minus(cashNeeded) : ZERO

  const applied = new Map<string, Decimal>()
  for (const line of lines) {
    if (line.isCash || line.amount.lte(0)) continue
    applied.set(line.id, line.amount)
  }

  let cashLeft = cashNeeded
  for (const line of lines) {
    if (!line.isCash || line.amount.lte(0)) continue
    const taken = cashLeft.lte(0) ? ZERO : Decimal.min(line.amount, cashLeft)
    cashLeft = cashLeft.minus(taken)
    if (taken.gt(0)) applied.set(line.id, taken)
  }

  // Same order as the dialog, so the slip lists the methods the cashier just saw.
  const payments: SettledPosPayment[] = []
  const tenders: SettledPosPayment[] = []
  for (const line of lines) {
    if (line.amount.gt(0)) {
      tenders.push({ paymentMethodId: line.id, amount: format(line.amount, decimals) })
    }
    const amount = applied.get(line.id)
    if (!amount || amount.lte(0)) continue
    payments.push({ paymentMethodId: line.id, amount: format(amount, decimals) })
  }

  const paid = nonCash.plus(cashTendered)
  const remaining = paid.gte(due) ? ZERO : due.minus(paid)
  const recorded = payments.reduce((total, payment) => total.plus(payment.amount), ZERO)

  const canValidate =
    nonCashWithinBalance && due.gt(0) && paid.gte(due) && payments.length > 0 && recorded.eq(due)

  return {
    paid: format(paid, decimals),
    remaining: format(remaining, decimals),
    change: format(change, decimals),
    nonCashWithinBalance,
    canValidate,
    payments,
    tenders,
  }
}

/**
 * What Exact / Remaining writes into one field: the amount still owed after
 * every other field. Blank when the sale is already covered.
 */
export function exactRemainingAmount(input: {
  due: Decimal.Value
  methodId: string
  amounts: Record<string, string | undefined>
  decimals?: number
}): string {
  const decimals = scaleOf(input.decimals)
  const due = quantize(input.due, decimals)
  let others = ZERO
  for (const [id, raw] of Object.entries(input.amounts)) {
    if (id === input.methodId) continue
    others = others.plus(parseEntered(raw, decimals))
  }
  const room = due.minus(others)
  return room.gt(0) ? format(room, decimals) : ''
}

/**
 * Next value for one payment field.
 * `null` means this keystroke is not an amount, so the field stays as it was.
 * A non-cash amount past the balance still owed (the sale minus every other
 * line already typed, including cash) is cut down to that balance. Cash is
 * left as typed, because the extra is change.
 */
export function clampPaymentDraft(input: {
  due: Decimal.Value
  method: PosPayMethod
  raw: string
  methods: PosPayMethod[]
  amounts: Record<string, string | undefined>
  decimals?: number
}): { value: string; clamped: boolean } | null {
  const decimals = scaleOf(input.decimals)
  if (input.raw === '') return { value: '', clamped: false }
  const pattern = decimals <= 0 ? /^\d*$/ : new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`)
  if (!pattern.test(input.raw)) return null
  if (input.method.isCash) return { value: input.raw, clamped: false }

  const due = quantize(input.due, decimals)
  const room = nonCashRoom(due, enteredLines(input.methods, input.amounts, decimals), input.method.id)
  const numericText = input.raw === '.' || input.raw.endsWith('.') ? input.raw.slice(0, -1) || '0' : input.raw
  let entered: Decimal
  try {
    entered = new Decimal(numericText)
  } catch {
    return null
  }
  if (!entered.isFinite() || entered.isNegative()) return null
  if (entered.lte(room)) return { value: input.raw, clamped: false }
  // Room of zero means the other lines — usually cash, including the part that
  // is change — already cover the sale. Wiping the keystroke leaves the field
  // empty. An empty field is not a non-cash payment, so it must not raise the
  // overpay error. A reduced amount that is still sitting in the field does.
  if (!room.gt(0)) return { value: '', clamped: false }
  return { value: format(room, decimals), clamped: true }
}

/**
 * The overpay message follows a clamp that left a non-cash amount in the field.
 * Cash overpay with the focused wallet still empty is change, not this error.
 */
export function nonCashDraftError(clamped: boolean, value: string): string | null {
  if (!clamped || value.trim() === '') return null
  return NON_CASH_OVERPAY_MESSAGE
}
