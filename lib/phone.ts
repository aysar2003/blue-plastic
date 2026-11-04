/**
 * Normalize a mobile number for storage and login lookup.
 * Accepts +252…, 00252…, or local 9–10 digit forms with an optional default country.
 */
export function normalizePhone(
  raw: string,
  defaultCountry = '252',
): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (!/^\d{8,15}$/.test(digits)) return null

  // Local Somali mobiles often omit the country code (61… / 9 digits).
  if (!digits.startsWith(defaultCountry) && digits.length <= 10) {
    digits = `${defaultCountry}${digits.replace(/^0+/, '')}`
  }

  if (digits.length < 10 || digits.length > 15) return null
  return `+${digits}`
}

/** True when the string looks like a phone rather than an email. */
export function looksLikePhone(raw: string): boolean {
  const t = raw.trim()
  if (t.includes('@')) return false
  return /^[\d\s+().-]{6,}$/.test(t)
}

/**
 * Resolve a login field to either an email or a normalized phone.
 * Returns null when neither is valid.
 */
export function parseLoginIdentifier(
  raw: string,
): { kind: 'email'; value: string } | { kind: 'phone'; value: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (looksLikePhone(trimmed)) {
    const phone = normalizePhone(trimmed)
    if (!phone) return null
    return { kind: 'phone', value: phone }
  }

  const email = trimmed.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return { kind: 'email', value: email }
}
