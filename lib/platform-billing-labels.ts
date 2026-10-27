import type { RentPaymentMethodInput } from '@/lib/validation/platform-billing'

export const RENT_METHOD_LABELS: Record<RentPaymentMethodInput, string> = {
  EVC: 'EVC Plus',
  ZAAD: 'Zaad',
  EDAHAB: 'eDahab',
  BANK: 'Bank transfer',
}

export const RENT_STATUS_LABELS = {
  PENDING: 'Pending review',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
} as const
