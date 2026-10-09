import type { PurchaseDocumentType } from '@prisma/client'

export type PurchaseTypeConfig = {
  type: PurchaseDocumentType
  slug: string
  /**
   * Other URLs that mean the same document.
   *
   * An expense paid on the spot is what most people call a *purchase receipt* —
   * it is the mirror of a sales receipt, and half the world's accounting
   * software names it that way. Rather than pick a winner and make the other
   * name a dead link, both reach the same screen.
   */
  aliases?: string[]
  singular: string
  plural: string
  effect: string
  /** True when the money leaves at once and it never becomes a payable. */
  needsPaymentAccount: boolean
  posts: boolean
}

export const PURCHASE_TYPES: PurchaseTypeConfig[] = [
  {
    type: 'BILL',
    slug: 'bills',
    singular: 'Bill',
    plural: 'Bills',
    effect: 'You owe the vendor. Payables go up, the cost is recognised.',
    needsPaymentAccount: false,
    posts: true,
  },
  {
    type: 'EXPENSE',
    slug: 'expenses',
    aliases: ['purchase-receipts'],
    singular: 'Expense',
    plural: 'Expenses',
    effect:
      'A purchase receipt: bought and paid at once. The money leaves the account you name, the cost is recognised, and any tracked stock on it is received — it never becomes a payable, so it is settled the moment it is entered.',
    needsPaymentAccount: true,
    posts: true,
  },
  {
    type: 'VENDOR_CREDIT',
    slug: 'vendor-credits',
    singular: 'Vendor credit',
    plural: 'Vendor credits',
    effect: 'The mirror of a bill. The cost comes back out and you owe less.',
    needsPaymentAccount: false,
    posts: true,
  },
  {
    type: 'PURCHASE_ORDER',
    slug: 'purchase-orders',
    singular: 'Purchase order',
    plural: 'Purchase orders',
    effect: 'An order placed. Nothing has happened yet, so nothing is posted to the ledger.',
    needsPaymentAccount: false,
    posts: false,
  },
]

export const purchaseBySlug = (slug: string) =>
  PURCHASE_TYPES.find((c) => c.slug === slug || c.aliases?.includes(slug))
export const purchaseByType = (type: PurchaseDocumentType) =>
  PURCHASE_TYPES.find((c) => c.type === type)!

/** Blank item rows on a new purchase form. Expense is shorter; bills and kin get 15. */
export function defaultPurchaseLineRows(type?: PurchaseDocumentType): number {
  if (type === 'EXPENSE') return 10
  return 15
}
