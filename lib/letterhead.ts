/** The company block that belongs on every document, PDF, and report. */
export type LetterheadSource = {
  name: string
  legalName?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
}

export type Letterhead = {
  name: string
  address: string
  phone: string | null
  email: string | null
}

export function letterheadOf(org: LetterheadSource): Letterhead {
  const street = [org.addressLine1, org.addressLine2].map(clean).filter(Boolean).join(', ')
  const place = [org.city, org.region, org.postalCode].map(clean).filter(Boolean).join(', ')
  const address = [street, place, clean(org.country)].filter(Boolean).join(', ')
  return {
    name: clean(org.legalName) || org.name,
    address,
    phone: clean(org.phone) || null,
    email: clean(org.email) || null,
  }
}

/** Name, then address, phone, and email — only the lines that are filled in. */
export function letterheadLines(org: LetterheadSource): string[] {
  const block = letterheadOf(org)
  return [block.name, block.address, block.phone ? `Phone ${block.phone}` : '', block.email ? `Email ${block.email}` : ''].filter(
    Boolean,
  )
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}
