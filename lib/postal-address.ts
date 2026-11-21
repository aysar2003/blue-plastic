/** Format a postal address for pickers, invoices, and work-site fields. */

export type PostalAddressParts = {
  label?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
}

export function formatPostalAddress(
  line1?: string | null,
  line2?: string | null,
  city?: string | null,
  region?: string | null,
  postalCode?: string | null,
  country?: string | null,
  separator = '\n',
): string {
  const place = [city, region, postalCode].map((part) => part?.trim()).filter(Boolean).join(', ')
  return [line1, line2, place, country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(separator)
}

export function formatPostalAddressLine(parts: PostalAddressParts): string {
  return formatPostalAddress(
    parts.line1,
    parts.line2,
    parts.city,
    parts.region,
    parts.postalCode,
    parts.country,
    ', ',
  )
}

/** One line for the sales work-site field: "Warehouse — street, city". */
export function formatShipToWorkSite(parts: PostalAddressParts): string {
  const address = formatPostalAddressLine(parts)
  const label = parts.label?.trim()
  if (label && address) return `${label} — ${address}`
  return label || address
}
