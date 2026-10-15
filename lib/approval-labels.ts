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
    CUSTOMER: 'Customer',
    VENDOR: 'Vendor',
  }
  return labels[type]
}
