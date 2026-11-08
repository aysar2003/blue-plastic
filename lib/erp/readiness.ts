/**
 * What “full SME ERP” means in this product: weekly operating loops plus the
 * legal-layer extras (hedge docs, kitchen display, first-party marketplace,
 * bins/picks, sign certificate, training).
 *
 * From Phase 22, progress is also tracked as world-ERP **layers** (L0–L9).
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
  {
    id: 'institutions',
    title: 'Institutions (industry packs → vertical-ready; onboarding wizard)',
    apps: ['settings', 'pos', 'hospitality', 'inventory'],
    ready: true,
  },
] as const

export type ErpLayerStatus = 'complete' | 'lite' | 'missing'

export type ErpLayer = {
  id: string
  title: string
  status: ErpLayerStatus
  /** Next phase that deepens this layer, if any. */
  nextPhase: number | null
  note: string
}

/**
 * World-ERP build layers. Status is product depth vs mid-market, not “broken”.
 * See docs/06-erp-layers.md.
 */
export const ERP_LAYERS: readonly ErpLayer[] = [
  {
    id: 'L0',
    title: 'Platform — identity, RBAC, audit, tenancy',
    status: 'complete',
    nextPhase: null,
    note: 'App shell complete; machine API keys ship in Phase 22 (L9).',
  },
  {
    id: 'L1',
    title: 'Financial core — GL, periods, close',
    status: 'complete',
    nextPhase: null,
    note: 'GL complete; one-jurisdiction VAT return (Phase 27).',
  },
  {
    id: 'L2',
    title: 'Master data — customers, vendors, items, tax',
    status: 'complete',
    nextPhase: null,
    note: 'Harden only; no wholesale rewrite.',
  },
  {
    id: 'L3',
    title: 'Order-to-cash / Procure-to-pay',
    status: 'complete',
    nextPhase: null,
    note: 'Trading chains + hard 3-way match (Phase 23).',
  },
  {
    id: 'L4',
    title: 'Inventory / WMS',
    status: 'complete',
    nextPhase: null,
    note: 'Lot/serial, picks post stock, bin qty / putaway / waves (Phase 31). Not robotics.',
  },
  {
    id: 'L5',
    title: 'Manufacturing',
    status: 'complete',
    nextPhase: null,
    note: 'BOM + MRP + assembly + SME work orders (Phase 28). Not MES.',
  },
  {
    id: 'L6',
    title: 'CRM / Projects',
    status: 'complete',
    nextPhase: null,
    note: 'Job P&L from sales, purchases, COGS, timesheets (Phase 25).',
  },
  {
    id: 'L7',
    title: 'HR / Payroll',
    status: 'complete',
    nextPhase: null,
    note: 'Operational payroll + statutory Excel/JSON export (Phase 27).',
  },
  {
    id: 'L8',
    title: 'Reporting / close',
    status: 'complete',
    nextPhase: null,
    note: 'Statements, packs, dashboards, snapshots (32), close pack/gates (33). Not a warehouse.',
  },
  {
    id: 'L9',
    title: 'Integration / AI',
    status: 'complete',
    nextPhase: null,
    note: 'Phase 22: capability registry, API keys, OpenAPI, MCP mirror.',
  },
] as const

export const ERP_NON_GOALS = [
  'Untrusted third-party plugins',
  'Qualified eIDAS / DocuSign trademark',
  'Robot / PLC hardware',
  'IoT kitchen printers',
  'FX dealing desk / ISDA',
] as const
