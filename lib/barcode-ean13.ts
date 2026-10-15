/**
 * In-store EAN-13 codes for products that do not yet have a package barcode.
 * Prefix 2xx is the usual retail range for internal / store-assigned numbers.
 */

export function ean13CheckDigit(twelveDigits: string): string {
  const digits = twelveDigits.replace(/\D/g, '')
  if (digits.length !== 12) {
    throw new Error(`EAN-13 body must be 12 digits, got ${digits.length}`)
  }
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const n = Number(digits[i])
    sum += i % 2 === 0 ? n : n * 3
  }
  return String((10 - (sum % 10)) % 10)
}

export function buildEan13(twelveDigits: string): string {
  const body = twelveDigits.replace(/\D/g, '').padStart(12, '0').slice(-12)
  return `${body}${ean13CheckDigit(body)}`
}

export function isValidEan13(code: string): boolean {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 13) return false
  return digits === buildEan13(digits.slice(0, 12))
}

/**
 * Next unused internal EAN-13 for this organisation.
 * Uses prefix 200 + a running 9-digit sequence taken from existing numeric barcodes.
 */
export function nextInternalEan13(existing: Iterable<string | null | undefined>): string {
  let maxSeq = 0
  for (const raw of existing) {
    if (!raw) continue
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 13 && digits.startsWith('200') && isValidEan13(digits)) {
      const seq = Number(digits.slice(3, 12))
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
    }
  }

  for (let attempt = 1; attempt <= 1_000_000; attempt += 1) {
    const seq = maxSeq + attempt
    if (seq > 999_999_999) break
    const code = buildEan13(`200${String(seq).padStart(9, '0')}`)
    const taken = [...existing].some(
      (raw) => raw && raw.replace(/\D/g, '').toLowerCase() === code,
    )
    if (!taken) return code
  }

  throw new Error('No free internal barcode left in the 200-range.')
}
