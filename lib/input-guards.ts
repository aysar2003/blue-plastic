/**
 * International typing rules for form fields.
 *
 * A money field must not accept letters. An account number must not accept
 * symbols. A phone field keeps digits and the few marks people actually dial.
 * Filtering happens as the person types so a wrong character never lands in
 * the value that is later validated or posted.
 */

import { INPUT_DECIMAL_SCALE } from '@/lib/money'

export { INPUT_DECIMAL_SCALE }

export type InputKind = 'decimal' | 'integer' | 'account-code' | 'phone' | 'date'

/**
 * Keep only what a decimal / money / quantity field may hold:
 * digits, one radix point, a leading sign, and the four arithmetic signs
 * the money parser already understands (120-10, 2*50, …). Cap fractional
 * digits at {@link INPUT_DECIMAL_SCALE}.
 */
export function filterDecimalInput(raw: string, maxDecimals = INPUT_DECIMAL_SCALE): string {
  let out = ''
  let sawDot = false
  let fraction = 0
  let start = true

  for (const ch of raw) {
    if (start && (ch === '+' || ch === '-')) {
      out += ch
      start = false
      continue
    }
    start = false

    if (ch >= '0' && ch <= '9') {
      if (sawDot) {
        if (fraction >= maxDecimals) continue
        fraction += 1
      }
      out += ch
      continue
    }

    if ((ch === '.' || ch === ',') && !sawDot) {
      // Comma is a thousands separator or a European radix; store as `.`
      // only when it is acting as the fractional point (no digits after yet
      // and we have not already got a point). Prefer `.` as the stored radix.
      if (ch === ',' && /\d$/.test(out) && !out.includes('.')) {
        // Thousands comma — drop it (1,234 → 1234).
        continue
      }
      if (ch === ',' && !/\d/.test(out)) continue
      out += '.'
      sawDot = true
      fraction = 0
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      // Starting a new operand resets the fraction tracker.
      out += ch
      sawDot = false
      fraction = 0
      start = ch === '('
      continue
    }

    if (ch === ' ' || ch === '\t') {
      out += ' '
      continue
    }
  }

  return out.replace(/ {2,}/g, ' ')
}

/** Digits only, optional leading minus — counts, reorder points, whole units. */
export function filterIntegerInput(raw: string, allowMinus = true): string {
  let out = ''
  let start = true
  for (const ch of raw) {
    if (start && allowMinus && ch === '-') {
      out += ch
      start = false
      continue
    }
    start = false
    if (ch >= '0' && ch <= '9') out += ch
  }
  return out
}

/** Chart account numbers: 4–8 digits in this product, digits only while typing. */
export function filterAccountCodeInput(raw: string): string {
  let out = ''
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9' && out.length < 8) out += ch
  }
  return out
}

/**
 * E.164-friendly phone typing: digits, spaces, and the marks used in
 * international numbers. Letters and other symbols are refused.
 */
export function filterPhoneInput(raw: string): string {
  let out = ''
  let plusUsed = false
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if (ch === '+' && !plusUsed && out.length === 0) {
      out += ch
      plusUsed = true
      continue
    }
    if (ch === ' ' || ch === '-' || ch === '(' || ch === ')' || ch === '.') {
      out += ch
    }
  }
  return out
}

/**
 * Calendar typing: digits and the separators people use (YYYY-MM-DD, DD/MM/YYYY).
 */
export function filterDateInput(raw: string): string {
  let out = ''
  for (const ch of raw) {
    if ((ch >= '0' && ch <= '9') || ch === '-' || ch === '/' || ch === '.') out += ch
  }
  return out
}

export function filterByKind(kind: InputKind, raw: string): string {
  switch (kind) {
    case 'decimal':
      return filterDecimalInput(raw)
    case 'integer':
      return filterIntegerInput(raw)
    case 'account-code':
      return filterAccountCodeInput(raw)
    case 'phone':
      return filterPhoneInput(raw)
    case 'date':
      return filterDateInput(raw)
  }
}

/**
 * Infer the filter from HTML attributes when the caller did not set
 * `data-input-kind`. Decimal and numeric modes are the common case.
 */
export function inferInputKind(attrs: {
  inputMode?: string | null
  type?: string | null
  name?: string | null
  id?: string | null
  inputKind?: string | null
}): InputKind | null {
  const explicit = attrs.inputKind
  if (
    explicit === 'decimal' ||
    explicit === 'integer' ||
    explicit === 'account-code' ||
    explicit === 'phone' ||
    explicit === 'date'
  ) {
    return explicit
  }

  const key = `${attrs.name ?? ''} ${attrs.id ?? ''}`.toLowerCase()
  if (/phone|mobile|whatsapp|(^|[^a-z])tel([^a-z]|$)/.test(key)) return 'phone'
  if (/(^|[^a-z])code([^a-z]|$)|accountnumber|account.?number/.test(key) && attrs.inputMode === 'numeric') {
    return 'account-code'
  }

  if (attrs.inputMode === 'decimal') return 'decimal'
  if (attrs.inputMode === 'numeric') return 'integer'
  if (attrs.inputMode === 'tel' || attrs.type === 'tel') return 'phone'
  if (attrs.type === 'date') return 'date'
  return null
}
