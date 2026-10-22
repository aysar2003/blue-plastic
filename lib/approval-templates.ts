import type { ApprovalEntityType } from '@prisma/client'

/** One rule inside a ready-made pack (Odoo / QuickBooks-style). */
export type ApprovalTemplateRule = {
  name: string
  entityType: ApprovalEntityType
  documentKind: string | null
  minAmount: string
  maxAmount: string | null
  priority: number
  levels: number
  requireDifferentApprover: boolean
}

export type ApprovalPack = {
  key: string
  name: string
  blurb: string
  rules: ApprovalTemplateRule[]
}

const SOX = { requireDifferentApprover: true } as const

/** Bills, invoices, payments, POs, transfers, journals — one checker. */
const STANDARD_RULES: ApprovalTemplateRule[] = [
  {
    name: 'Invoices',
    entityType: 'SALES_DOCUMENT',
    documentKind: 'INVOICE',
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Credit memos',
    entityType: 'SALES_DOCUMENT',
    documentKind: 'CREDIT_MEMO',
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Purchase orders',
    entityType: 'PURCHASE_DOCUMENT',
    documentKind: 'PURCHASE_ORDER',
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Bills',
    entityType: 'PURCHASE_DOCUMENT',
    documentKind: 'BILL',
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Customer payments',
    entityType: 'CUSTOMER_PAYMENT',
    documentKind: null,
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Bill payments',
    entityType: 'BILL_PAYMENT',
    documentKind: null,
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Bank transfers',
    entityType: 'BANK_TRANSFER',
    documentKind: null,
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
  {
    name: 'Journals',
    entityType: 'JOURNAL',
    documentKind: null,
    minAmount: '0',
    maxAmount: null,
    priority: 40,
    levels: 1,
    ...SOX,
  },
]

/** Same as standard, plus a second signer on invoices and bills of 1,000 or more. */
function amountBandRules(): ApprovalTemplateRule[] {
  const rest = STANDARD_RULES.filter(
    (rule) =>
      !(rule.entityType === 'SALES_DOCUMENT' && rule.documentKind === 'INVOICE') &&
      !(rule.entityType === 'PURCHASE_DOCUMENT' && rule.documentKind === 'BILL'),
  )
  return [
    {
      name: 'Invoices under 1,000',
      entityType: 'SALES_DOCUMENT',
      documentKind: 'INVOICE',
      minAmount: '0',
      maxAmount: '1000',
      priority: 10,
      levels: 1,
      ...SOX,
    },
    {
      name: 'Invoices 1,000 and over',
      entityType: 'SALES_DOCUMENT',
      documentKind: 'INVOICE',
      minAmount: '1000',
      maxAmount: null,
      priority: 10,
      levels: 2,
      ...SOX,
    },
    {
      name: 'Bills under 1,000',
      entityType: 'PURCHASE_DOCUMENT',
      documentKind: 'BILL',
      minAmount: '0',
      maxAmount: '1000',
      priority: 10,
      levels: 1,
      ...SOX,
    },
    {
      name: 'Bills 1,000 and over',
      entityType: 'PURCHASE_DOCUMENT',
      documentKind: 'BILL',
      minAmount: '1000',
      maxAmount: null,
      priority: 10,
      levels: 2,
      ...SOX,
    },
    ...rest,
  ]
}

export const APPROVAL_PACKS: ApprovalPack[] = [
  {
    key: 'standard',
    name: 'Standard checker',
    blurb:
      'Like QuickBooks: invoices, credit memos, bills, purchase orders, payments, transfers, and journals wait for one other person. Quotations, estimates, and POS still go through without this gate.',
    rules: STANDARD_RULES,
  },
  {
    key: 'amount-bands',
    name: 'Amount bands',
    blurb:
      'Like Odoo: the standard set, plus a second signer when an invoice or bill is 1,000 or more (company currency).',
    rules: amountBandRules(),
  },
]

export function approvalPack(key: string): ApprovalPack | undefined {
  return APPROVAL_PACKS.find((pack) => pack.key === key)
}

/** Catch-all family rule: every kind, any amount. */
export function isCatchAllRule(rule: {
  documentKind: string | null | undefined
  minAmount: { toString(): string } | string | number
  maxAmount: { toString(): string } | string | number | null | undefined
}): boolean {
  if (rule.documentKind) return false
  const min = Number(rule.minAmount.toString())
  if (min > 0) return false
  return rule.maxAmount == null || rule.maxAmount === ''
}

const FAMILIES_WITH_KINDS = new Set(['SALES_DOCUMENT', 'PURCHASE_DOCUMENT'])

/**
 * Sales/Purchases rule with a blank kind — invoices, quotations, estimates,
 * bills, and POs all wait. Ready-made packs turn these off.
 */
export function isFamilyWideKindRule(rule: {
  entityType: string
  documentKind: string | null | undefined
}): boolean {
  return !rule.documentKind && FAMILIES_WITH_KINDS.has(rule.entityType)
}
