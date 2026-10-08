import type { SalesDocumentType } from '@prisma/client'

/** Everything the UI needs to know about a document type, in one place. */
export type SalesTypeConfig = {
  type: SalesDocumentType
  slug: string
  singular: string
  plural: string
  /** What the document does to the ledger, said plainly. */
  effect: string
  /** True when the money moves at once and never becomes a receivable. */
  needsDeposit: boolean
  posts: boolean
  createPermission: 'invoice:create'
}

export const SALES_TYPES: SalesTypeConfig[] = [
  {
    type: 'INVOICE',
    slug: 'invoices',
    singular: 'Invoice',
    plural: 'Invoices',
    effect: 'The customer owes you. Receivables go up, income is recognised.',
    needsDeposit: false,
    posts: true,
    createPermission: 'invoice:create',
  },
  {
    type: 'ESTIMATE',
    slug: 'estimates',
    singular: 'Quotation',
    plural: 'Quotations',
    effect: 'A quotation. Nothing has happened yet, so nothing is posted to the ledger.',
    needsDeposit: false,
    posts: false,
    createPermission: 'invoice:create',
  },
  {
    type: 'SALES_RECEIPT',
    slug: 'sales-receipts',
    singular: 'Sales receipt',
    plural: 'Sales receipts',
    effect: 'Paid on the spot. The money lands in an account and never becomes a receivable.',
    needsDeposit: true,
    posts: true,
    createPermission: 'invoice:create',
  },
  {
    type: 'CREDIT_MEMO',
    slug: 'credit-memos',
    singular: 'Credit memo',
    plural: 'Credit memos',
    effect: 'The mirror of an invoice. Income comes back out and the customer owes less.',
    needsDeposit: false,
    posts: true,
    createPermission: 'invoice:create',
  },
  {
    type: 'REFUND_RECEIPT',
    slug: 'refunds',
    singular: 'Refund',
    plural: 'Refunds',
    effect: 'Money handed back, straight out of an account.',
    needsDeposit: true,
    posts: true,
    createPermission: 'invoice:create',
  },
]

/** Blank item rows a new sales sheet shows. Kept low so the form fits one screen. */
export function defaultLineRows(_type?: SalesDocumentType): number {
  return 4
}

/** Extra blank lines when printing a ruled sheet. */
export function printSheetLinePad(_type?: SalesDocumentType): number {
  return 8
}

export const bySlug = (slug: string): SalesTypeConfig | undefined =>
  SALES_TYPES.find((config) => config.slug === slug)

export const byType = (type: SalesDocumentType): SalesTypeConfig =>
  SALES_TYPES.find((config) => config.type === type)!

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  PARTIAL: 'Part paid',
  PAID: 'Paid',
  VOID: 'Void',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  CLOSED: 'Closed',
}

export const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  DRAFT: 'outline',
  OPEN: 'default',
  PARTIAL: 'warning',
  PAID: 'success',
  VOID: 'destructive',
  ACCEPTED: 'success',
  DECLINED: 'outline',
  CLOSED: 'secondary',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
  MOBILE_MONEY: 'Mobile money',
  OTHER: 'Other',
}
