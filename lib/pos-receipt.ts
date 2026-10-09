/** Thermal roll widths the receipt can print on. 80mm is the usual counter printer. */
export const RECEIPT_PAPERS = {
  '80': { widthMm: 80, padMm: 4, fontPx: 12 },
  '58': { widthMm: 58, padMm: 2.5, fontPx: 10.5 },
} as const

export type ReceiptPaper = keyof typeof RECEIPT_PAPERS

export const RECEIPT_PAPER_KEY = 'pos.receipt.paper'
export const DEFAULT_RECEIPT_PAPER: ReceiptPaper = '80'

export function parseReceiptPaper(value: unknown): ReceiptPaper {
  return value === '58' || value === '80' ? value : DEFAULT_RECEIPT_PAPER
}

/** Change handed back, as passed by the till right after the sale. Anything odd reads as none. */
export function parseChange(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0.004 ? Math.round(n * 100) / 100 : 0
}

export type ReceiptPayment = { method: string; amount: string; isCash: boolean }

/**
 * Who the slip names as cashier.
 * A till is named for the person who sells on it. The document creator is
 * whoever was signed in, often an admin, so a till sale uses the register name.
 * A receipt with no till keeps the person who created it.
 */
export function receiptCashierName(
  registerName: string | null,
  signedIn: { name: string | null; email: string } | null,
): string | null {
  if (registerName) return registerName
  if (!signedIn) return null
  return signedIn.name || signedIn.email
}

/**
 * The payment block under the total. The ledger records what the sale took from
 * each method; cash handed over beyond that came back as change, so the cash line
 * shows what the customer actually handed over. Methods recorded at zero are
 * omitted — a blank tender is not a payment.
 */
export function paymentRows(
  payments: ReceiptPayment[],
  total: string,
  change: number,
  options: { tendered?: boolean } = {},
) {
  const active = payments.filter((payment) => Number(payment.amount) > 0.004)
  // New sales store the notes that were handed over. Adding change again would
  // show Cash 113 on a $100 tender. Older slips stored the net and passed change
  // separately, so that cash line still has to grow by the change.
  if (options.tendered) {
    const rows = active.map((payment) => ({ label: payment.method, amount: Number(payment.amount) }))
    const paid = rows.reduce((sum, row) => sum + row.amount, 0)
    return { rows, paid: active.length > 0 ? paid : Number(total), change: change > 0.004 ? change : 0 }
  }
  const cashIndex = change > 0 ? active.findIndex((payment) => payment.isCash) : -1
  const effectiveChange = cashIndex >= 0 ? change : 0
  const rows = active.map((payment, index) => ({
    label: payment.method,
    amount: Number(payment.amount) + (index === cashIndex ? effectiveChange : 0),
  }))
  const recorded = active.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const paid = (active.length > 0 ? recorded : Number(total)) + effectiveChange
  return { rows, paid, change: effectiveChange }
}

/** 2.0000 → "2", 1.5000 → "1.5". */
export function trimQty(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

/** px → mm at the CSS 96dpi the print engine uses. */
export function pxToMm(px: number): number {
  return (px * 25.4) / 96
}
