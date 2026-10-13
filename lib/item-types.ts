import type { ItemType } from '@prisma/client'

/**
 * QuickBooks-style item kinds. Selecting a type opens that type’s form only.
 */
export type ItemTypeProfile = {
  value: ItemType
  label: string
  /** QuickBooks help text shown beside / under the type. */
  blurb: string
  accounts: {
    income: boolean
    expense: boolean
    cogs: boolean
    inventory: boolean
    deposit: boolean
  }
  buying: boolean
  stock: boolean
  /** Bill of materials / group member lines. */
  components: boolean
  discountIncome: boolean
  payment: boolean
}

export const ITEM_TYPE_PROFILES: ItemTypeProfile[] = [
  {
    value: 'SERVICE',
    label: 'Service',
    blurb:
      'Use for services you charge for or purchase, like specialized labor, consulting hours, or professional fees.',
    accounts: { income: true, expense: true, cogs: false, inventory: false, deposit: false },
    buying: false,
    stock: false,
    components: false,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'INVENTORY',
    label: 'Inventory Part',
    blurb: 'Use for goods you purchase, track as inventory, and resell.',
    accounts: { income: true, expense: false, cogs: true, inventory: true, deposit: false },
    buying: true,
    stock: true,
    components: false,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'INVENTORY_ASSEMBLY',
    label: 'Inventory Assembly',
    blurb: 'Use for things you assemble from other inventory items and then sell.',
    accounts: { income: true, expense: false, cogs: true, inventory: true, deposit: false },
    buying: true,
    stock: true,
    components: true,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'NON_INVENTORY',
    label: 'Non-inventory Part',
    blurb:
      "Use for goods you buy but don't track, like office supplies, or materials for a specific job that you charge back to the customer.",
    accounts: { income: true, expense: false, cogs: true, inventory: false, deposit: false },
    buying: true,
    stock: false,
    components: false,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'OTHER_CHARGE',
    label: 'Other Charge',
    blurb:
      'Use for miscellaneous labor, material, or part charges, such as delivery charges, setup fees, and service charges.',
    accounts: { income: true, expense: true, cogs: false, inventory: false, deposit: false },
    buying: false,
    stock: false,
    components: false,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'SUBTOTAL',
    label: 'Subtotal',
    blurb:
      'Use to total all items above it on a form, up to the last subtotal. Useful for applying a percentage discount or surcharge to many items.',
    accounts: { income: false, expense: false, cogs: false, inventory: false, deposit: false },
    buying: false,
    stock: false,
    components: false,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'GROUP',
    label: 'Group',
    blurb: 'Use to quickly enter a group of individual items on an invoice.',
    accounts: { income: false, expense: false, cogs: false, inventory: false, deposit: false },
    buying: false,
    stock: false,
    components: true,
    discountIncome: false,
    payment: false,
  },
  {
    value: 'DISCOUNT',
    label: 'Discount',
    blurb:
      'Use to subtract a percentage or fixed amount from a total or subtotal. Do not use this item type for an early payment discount.',
    accounts: { income: true, expense: false, cogs: false, inventory: false, deposit: false },
    buying: false,
    stock: false,
    components: false,
    discountIncome: true,
    payment: false,
  },
  {
    value: 'PAYMENT',
    label: 'Payment',
    blurb: 'Use to record a partial payment at the time of the sale. It reduces the amount owed on an invoice.',
    accounts: { income: false, expense: false, cogs: false, inventory: false, deposit: true },
    buying: false,
    stock: false,
    components: false,
    discountIncome: false,
    payment: true,
  },
]

export const ENABLED_ITEM_TYPES = ITEM_TYPE_PROFILES.map((p) => p.value)

export function profileForType(type: ItemType): ItemTypeProfile {
  return ITEM_TYPE_PROFILES.find((p) => p.value === type) ?? ITEM_TYPE_PROFILES[0]!
}

export function itemTypeLabel(type: ItemType): string {
  return profileForType(type).label
}

export function isStockTracked(type: ItemType): boolean {
  return type === 'INVENTORY' || type === 'INVENTORY_ASSEMBLY'
}

export function usesOperatingExpense(type: ItemType): boolean {
  return type === 'SERVICE' || type === 'OTHER_CHARGE'
}

export function usesCogsCost(type: ItemType): boolean {
  return type === 'NON_INVENTORY' || isStockTracked(type)
}

/** Types that never post through an income account on the item itself. */
export function skipsIncomeAccount(type: ItemType): boolean {
  return type === 'SUBTOTAL' || type === 'GROUP' || type === 'PAYMENT'
}

/** Discount items reduce the document total — they never add to it (QuickBooks Desktop). */
export function isDiscountItem(type: string | null | undefined): boolean {
  return type === 'DISCOUNT'
}

/** Subtotal lines show a running sum only — they do not add to the document total. */
export function isSubtotalItem(type: string | null | undefined): boolean {
  return type === 'SUBTOTAL'
}

/** Payment items reduce amount due and post to a deposit account, not income. */
export function isPaymentItem(type: string | null | undefined): boolean {
  return type === 'PAYMENT'
}

/** Group items expand into their member lines on a sales form. */
export function isGroupItem(type: string | null | undefined): boolean {
  return type === 'GROUP'
}
