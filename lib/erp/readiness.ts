/**
 * What “full SME ERP” means in this product: weekly operating loops plus the
 * legal-layer extras (hedge docs, kitchen display, first-party marketplace,
 * bins/picks, sign certificate, training).
 *
 * Remaining non-goals are hardware, trademarks, and untrusted code — not SME books.
 */

export type ReadyLoop = {
  id: string
  title: string
  apps: string[]
  ready: true
}

export const ERP_READY_LOOPS: readonly ReadyLoop[] = [
  {
    id: 'sell',
    title: 'Sell (estimate → order → invoice / POS → delivery; kitchen tickets)',
    apps: ['sales', 'pos', 'customers', 'portal'],
    ready: true,
  },
  {
    id: 'collect',
    title: 'Collect (payment → undeposited → deposit → reconcile)',
    apps: ['payments', 'banking'],
    ready: true,
  },
  {
    id: 'buy',
    title: 'Buy (RFQ → PO → receive → bill → pay)',
    apps: ['purchases', 'vendors', 'bill-payments'],
    ready: true,
  },
  {
    id: 'stock',
    title: 'Stock (on hand, adjust, transfer, barcode, MRP, bins / picks)',
    apps: ['inventory', 'stores', 'barcodes'],
    ready: true,
  },
  {
    id: 'books',
    title: 'Books (ledger, FX reval, hedge docs, assets, equity, close, group P&L/BS)',
    apps: ['accounting', 'journals', 'periods', 'reports'],
    ready: true,
  },
  {
    id: 'crm',
    title: 'CRM (opportunity pipeline + follow-up activities)',
    apps: ['customers'],
    ready: true,
  },
  {
    id: 'people',
    title: 'People (ATS, hire, appraisals, payroll backup, leave, training)',
    apps: ['employees'],
    ready: true,
  },
  {
    id: 'collab',
    title: 'Collab (sign certificate, discuss @mentions, appointments, planning, surveys)',
    apps: ['sign', 'discuss', 'appointments', 'planning', 'surveys'],
    ready: true,
  },
  {
    id: 'marketplace',
    title: 'Marketplace (first-party install of granted modules)',
    apps: ['settings'],
    ready: true,
  },
] as const

export const ERP_NON_GOALS = [
  'Untrusted third-party plugins',
  'Qualified eIDAS / DocuSign trademark',
  'Robot / PLC hardware',
  'IoT kitchen printers',
  'FX dealing desk / ISDA',
] as const
