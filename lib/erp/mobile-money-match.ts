/**
 * Suggest invoice matches for mobile-money / statement lines (Wave G).
 * Pure scoring — no DB. Amount must match exactly (same rule as journal suggest).
 */
import { money } from '@/lib/money'

export type MmInvoiceCandidate = {
  id: string
  number: string
  customerId: string
  outstanding: string
  /** Optional MSISDN / till / paybill on the customer. */
  partyRef?: string | null
}

export type MmStatementHint = {
  amount: string
  /** Absolute value compared to outstanding. */
  description?: string | null
  reference?: string | null
  externalId?: string | null
  partyRef?: string | null
}

export type MmMatchSuggestion = {
  invoiceId: string
  invoiceNumber: string
  customerId: string
  score: number
  reason: 'amount+ref' | 'amount+party' | 'amount+desc' | 'amount'
}

const REF_RE = /\b(?:INV|INVOICE)[- ]?([A-Z0-9/-]+)\b/i
const DIGITS = /\d{7,}/g

export function extractPartyRef(
  description: string | null | undefined,
  reference?: string | null,
): string | null {
  const blob = `${description ?? ''} ${reference ?? ''}`
  const msisdn = blob.match(DIGITS)
  if (msisdn?.[0]) return msisdn[0]
  return null
}

export function extractInvoiceHint(
  description: string | null | undefined,
  reference?: string | null,
  externalId?: string | null,
): string | null {
  for (const part of [reference, externalId, description]) {
    if (!part) continue
    const hit = part.match(REF_RE)
    if (hit?.[1]) return hit[1].toUpperCase()
    const trimmed = part.trim().toUpperCase()
    if (/^[A-Z0-9][A-Z0-9/-]{2,}$/.test(trimmed) && /[A-Z]/.test(trimmed)) return trimmed
  }
  return null
}

/**
 * Score open invoices against one incoming statement amount.
 * Exact outstanding match required; refs/party boost the score.
 */
export function suggestInvoiceMatches(
  hint: MmStatementHint,
  invoices: MmInvoiceCandidate[],
): MmMatchSuggestion[] {
  const amount = money(hint.amount).abs()
  if (amount.lte(0)) return []

  const invoiceHint = extractInvoiceHint(hint.description, hint.reference, hint.externalId)
  const party =
    (hint.partyRef?.replace(/\D/g, '') || null) ??
    extractPartyRef(hint.description, hint.reference)

  const out: MmMatchSuggestion[] = []
  for (const inv of invoices) {
    const outstanding = money(inv.outstanding)
    if (!outstanding.eq(amount)) continue

    let score = 50
    let reason: MmMatchSuggestion['reason'] = 'amount'

    if (invoiceHint && inv.number.toUpperCase().includes(invoiceHint)) {
      score = 95
      reason = 'amount+ref'
    } else if (party && inv.partyRef && digitsEqual(party, inv.partyRef)) {
      score = 85
      reason = 'amount+party'
    } else if (
      hint.description &&
      inv.number &&
      hint.description.toUpperCase().includes(inv.number.toUpperCase())
    ) {
      score = 75
      reason = 'amount+desc'
    }

    out.push({
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      customerId: inv.customerId,
      score,
      reason,
    })
  }

  return out.sort((a, b) => b.score - a.score || a.invoiceNumber.localeCompare(b.invoiceNumber))
}

function digitsEqual(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (!da || !db) return false
  return da === db || da.endsWith(db) || db.endsWith(da)
}

/** Prefer MOBILE_MONEY method when the statement looks like MM. */
export function isMobileMoneyStatement(hint: {
  description?: string | null
  partyRef?: string | null
  packId?: string | null
}): boolean {
  if (hint.partyRef?.trim()) return true
  const d = (hint.description ?? '').toLowerCase()
  if (/\b(mpesa|m-pesa|evc|zaad|edahab|waafi|airtel\s*money|till|paybill)\b/.test(d)) {
    return true
  }
  return hint.packId === 'ke' || hint.packId === 'so'
}
