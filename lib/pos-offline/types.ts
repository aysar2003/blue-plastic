/** Checkout payload queued while the till is offline (matches posCheckoutSchema). */
export type PosOfflineCheckoutPayload = {
  registerId: string
  sessionId: string
  customerId?: string
  projectId?: string
  note?: string | null
  lines: {
    itemId: string
    quantity: string
    unitPrice?: string
    storeId?: string
    lotNumber?: string
    serialNumber?: string
  }[]
  payments: { paymentMethodId: string; amount: string }[]
  changeMethodId?: string
  estimateId?: string
  tipAmount?: string
  diningTableId?: string
  prescriptionRef?: string | null
  clientSaleId: string
}

export type PosOfflinePendingSale = PosOfflineCheckoutPayload & {
  createdAt: string
  localStatus: 'pending' | 'syncing' | 'failed'
  lastError?: string | null
  /** Local total for toast / banner (display only). */
  totalLabel: string
}

export type PosOfflineProduct = {
  id: string
  name: string
  sku: string | null
  barcode?: string | null
  category: string | null
  unitOfMeasure?: string | null
  price: string
  /** Used when the selected walk-in customer is wholesale. */
  wholesalePrice?: string | null
  trackLots?: boolean
  trackSerials?: boolean
  pharmacyControlled?: boolean
  onHand: string | null
  stock?: Record<string, string> | null
}

export type PosOfflineSnapshot = {
  key: string
  orgId: string
  registerId: string
  sessionId: string
  currency: string
  orgName: string
  registerName: string
  paymentMethods: {
    id: string
    name: string
    isCash: boolean
    allowsChangeReturn: boolean
  }[]
  products: PosOfflineProduct[]
  customers: { id: string; displayName: string; priceLevel?: 'RETAIL' | 'WHOLESALE' }[]
  stockStoreId: string | null
  stockStoreName: string | null
  stores: { id: string; name: string }[]
  savedAt: string
}
