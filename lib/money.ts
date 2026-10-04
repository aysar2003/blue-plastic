import { Decimal } from 'decimal.js'

/**
 * Money is a Decimal, always. It is stored as NUMERIC(19,4), travels as a decimal
 * string, and is formatted for display — it never becomes a JavaScript `number`
 * at any point. See ADR-0003.
 */
export type Money = Decimal

/** Storage scale. Unit prices and rates need more than 2 decimals; postings do not. */
export const STORAGE_SCALE = 4

/** Minor units per currency, for rounding amounts that will be posted. */
const MINOR_UNITS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, KES: 2, AED: 2, CAD: 2, AUD: 2, CHF: 2, ZAR: 2, INR: 2,
  SOS: 2, ETB: 2, NGN: 2, CNY: 2, SAR: 2, TRY: 2,
  JPY: 0, KRW: 0, UGX: 0, VND: 0, CLP: 0, ISK: 0, RWF: 0, DJF: 0,
  BHD: 3, KWD: 3, OMR: 3, JOD: 3, TND: 3,
}

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2
}

export const ZERO: Money = new Decimal(0)

export function money(value: Decimal.Value | null | undefined): Money {
  if (value === null || value === undefined || value === '') return ZERO
  return new Decimal(value)
}

/**
 * Commercial rounding: half away from zero. Banker's rounding is defensible in
 * statistics and indefensible on an invoice a customer is holding.
 */
export function round(value: Decimal.Value, decimals: number): Money {
  return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
}

/** Round to the currency's smallest postable unit. Every posted amount goes through this. */
export function roundToCurrency(value: Decimal.Value, currency: string): Money {
  return round(value, minorUnits(currency))
}

export function sum(values: Iterable<Decimal.Value>): Money {
  let total = ZERO
  for (const v of values) total = total.plus(v)
  return total
}

export const isZero = (v: Decimal.Value): boolean => new Decimal(v).isZero()
export const isNegative = (v: Decimal.Value): boolean => new Decimal(v).isNegative()
export const eq = (a: Decimal.Value, b: Decimal.Value): boolean => new Decimal(a).equals(b)

/** Canonical wire/storage form: a plain decimal string, never exponential notation. */
export function toMoneyString(value: Decimal.Value, decimals = STORAGE_SCALE): string {
  return new Decimal(value).toFixed(decimals)
}

/**
 * Parse user input. Accepts thousands separators, a leading currency symbol,
 * and the four arithmetic signs: 120-10, 2*50, 100/4, 10+5.
 * Anything else is rejected rather than guessed — a silently-misparsed amount
 * is worse than a validation message.
 */
export function parseMoneyInput(input: string): Money | null {
  const cleaned = input.trim().replace(/[\s,]/g, '').replace(/^[^\d\-+.(]+/, '')
  if (cleaned === '') return null
  const value = evaluateArithmetic(cleaned)
  return value && value.isFinite() ? value : null
}

/** True when the text is a sum, difference, product, or quotient rather than a plain number. */
export function hasArithmetic(input: string): boolean {
  const cleaned = input.trim().replace(/[\s,]/g, '').replace(/^[^\d\-+.(]+/, '')
  return /[+\-*/()]/.test(cleaned.replace(/^[+-]/, ''))
}

/**
 * The number an arithmetic entry settles to, written without trailing zeros.
 * A plain number is left alone, so typing 10.50 is not rewritten on the way out.
 */
export function settleNumberInput(input: string): string | null {
  if (!hasArithmetic(input)) return null
  const value = parseMoneyInput(input)
  if (!value) return null
  return value
    .toDecimalPlaces(STORAGE_SCALE, Decimal.ROUND_HALF_UP)
    .toFixed(STORAGE_SCALE)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

/**
 * + and - bind looser than * and /. Parentheses and a leading minus are allowed.
 * An unfinished sum such as "120-" is rejected so the field can keep being typed.
 */
function evaluateArithmetic(source: string): Decimal | null {
  let index = 0

  const peek = () => source[index]

  function number(): Decimal | null {
    const start = index
    if (peek() === '.') {
      index += 1
      while (index < source.length && source[index]! >= '0' && source[index]! <= '9') index += 1
    } else {
      while (index < source.length && source[index]! >= '0' && source[index]! <= '9') index += 1
      if (peek() === '.') {
        index += 1
        while (index < source.length && source[index]! >= '0' && source[index]! <= '9') index += 1
      }
    }
    const raw = source.slice(start, index)
    if (raw === '' || raw === '.') return null
    try {
      return new Decimal(raw)
    } catch {
      return null
    }
  }

  function unary(): Decimal | null {
    if (peek() === '+') {
      index += 1
      return unary()
    }
    if (peek() === '-') {
      index += 1
      const value = unary()
      return value ? value.negated() : null
    }
    if (peek() === '(') {
      index += 1
      const value = sum()
      if (peek() !== ')' || !value) return null
      index += 1
      return value
    }
    return number()
  }

  function product(): Decimal | null {
    let left = unary()
    if (!left) return null
    while (peek() === '*' || peek() === '/') {
      const operator = peek()
      index += 1
      const right = unary()
      if (!right || (operator === '/' && right.isZero())) return null
      left = operator === '*' ? left.times(right) : left.dividedBy(right)
    }
    return left
  }

  function sum(): Decimal | null {
    let left = product()
    if (!left) return null
    while (peek() === '+' || peek() === '-') {
      const operator = peek()
      index += 1
      const right = product()
      if (!right) return null
      left = operator === '+' ? left.plus(right) : left.minus(right)
    }
    return left
  }

  const value = sum()
  if (!value || index !== source.length) return null
  return value
}

export function formatMoney(
  value: Decimal.Value,
  currency = 'USD',
  options: { locale?: string; showSymbol?: boolean } = {},
): string {
  const { locale = 'en-US', showSymbol = true } = options
  const decimals = minorUnits(currency)
  const n = Number(round(value, decimals).toFixed(decimals))
  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/**
 * Display a ledger amount by its natural side. Accounting reports show a credit
 * balance on a revenue account as a positive number, not as a negative asset.
 */
export function formatSigned(value: Decimal.Value, currency = 'USD'): string {
  const d = new Decimal(value)
  return d.isNegative() ? `(${formatMoney(d.abs(), currency)})` : formatMoney(d, currency)
}

/**
 * Split an amount into `parts` pieces that sum exactly to the original.
 * Used wherever a total must be allocated across lines (tax, discounts,
 * payment application) without losing or inventing a cent.
 */
export function allocate(total: Decimal.Value, weights: Decimal.Value[], currency = 'USD'): Money[] {
  const amount = new Decimal(total)
  const weightTotal = sum(weights)
  if (weightTotal.isZero()) return weights.map(() => ZERO)

  const decimals = minorUnits(currency)
  const allocated: Money[] = []
  let running = ZERO

  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      allocated.push(round(amount.minus(running), decimals))
    } else {
      const share = round(amount.times(weights[i]).dividedBy(weightTotal), decimals)
      allocated.push(share)
      running = running.plus(share)
    }
  }
  return allocated
}

export { Decimal }
