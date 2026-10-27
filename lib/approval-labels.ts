import type { ApprovalEntityType } from '@prisma/client'

/** All document families that can have an approval workflow. */
export const APPROVAL_ENTITY_TYPES: ApprovalEntityType[] = [
  'SALES_DOCUMENT',
  'PURCHASE_DOCUMENT',
  'CUSTOMER_PAYMENT',
  'BILL_PAYMENT',
  'JOURNAL',
  'INVENTORY_ADJUSTMENT',
  'BANK_TRANSFER',
  'DEPOSIT',
  'CUSTOMER',
  'VENDOR',
]

/** Plain labels for the Approvals inbox and policy form. */
export function entityTypeLabel(type: ApprovalEntityType): string {
  const labels: Record<ApprovalEntityType, string> = {
    SALES_DOCUMENT: 'Sales',
    PURCHASE_DOCUMENT: 'Purchases',
    CUSTOMER_PAYMENT: 'Customer payment',
    BILL_PAYMENT: 'Bill payment',
    JOURNAL: 'Journal',
    INVENTORY_ADJUSTMENT: 'Stock adjustment',
    BANK_TRANSFER: 'Bank transfer',
    DEPOSIT: 'Deposit',
    CUSTOMER: 'Customer (opening / credit)',
    VENDOR: 'Vendor (opening)',
  }
  return labels[type]
}

/**
 * Optional subtypes inside Sales / Purchases so a company can require approval
 * for purchase orders only, sales orders only, invoices only, etc.
 */
export const APPROVAL_DOCUMENT_KINDS: Record<
  ApprovalEntityType,
  { value: string; label: string }[]
> = {
  SALES_DOCUMENT: [
    { value: 'INVOICE', label: 'Invoices only' },
    { value: 'SALES_RECEIPT', label: 'Sales receipts only' },
    { value: 'SALES_ORDER', label: 'Sales orders only' },
    { value: 'ESTIMATE', label: 'Estimates only' },
    { value: 'QUOTATION', label: 'Quotations only' },
    { value: 'CREDIT_MEMO', label: 'Credit memos only' },
    { value: 'REFUND_RECEIPT', label: 'Refund receipts only' },
  ],
  PURCHASE_DOCUMENT: [
    { value: 'BILL', label: 'Bills only' },
    { value: 'EXPENSE', label: 'Expenses / purchase receipts only' },
    { value: 'PURCHASE_ORDER', label: 'Purchase orders only' },
    { value: 'PURCHASE_REQUEST', label: 'Purchase requests only' },
    { value: 'RFQ', label: 'RFQs only' },
    { value: 'VENDOR_CREDIT', label: 'Vendor credits only' },
  ],
  CUSTOMER_PAYMENT: [],
  BILL_PAYMENT: [],
  JOURNAL: [],
  INVENTORY_ADJUSTMENT: [],
  BANK_TRANSFER: [],
  DEPOSIT: [],
  CUSTOMER: [],
  VENDOR: [],
}

export function documentKindLabel(
  entityType: ApprovalEntityType,
  kind: string | null | undefined,
): string {
  if (!kind) return 'All in this family'
  const option = APPROVAL_DOCUMENT_KINDS[entityType]?.find((row) => row.value === kind)
  return option?.label ?? kind
}

/** True when `kind` is allowed for this family (or blank = whole family). */
export function isValidDocumentKind(
  entityType: ApprovalEntityType,
  kind: string | null | undefined,
): boolean {
  if (!kind) return true
  return (APPROVAL_DOCUMENT_KINDS[entityType] ?? []).some((row) => row.value === kind)
}
