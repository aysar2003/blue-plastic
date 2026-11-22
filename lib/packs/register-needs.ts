/**
 * Register step “Needs” — pack-aware choices that refine modules + behavioral flags.
 * Pure / no I/O.
 */
import type { ModuleFlag, OrgFeatureFlags } from '@/lib/feature-flags'

import { getPack } from './registry'
import { modulesFromPack } from './resolve'
import type { PackId } from './types'

export type RegisterNeedId =
  | 'payroll'
  | 'tax'
  | 'approvals'
  | 'portal'
  | 'pos'
  | 'inventory'
  | 'purchases'
  | 'multiStore'
  | 'lots'
  | 'discuss'
  | 'documents'
  | 'calendar'
  | 'sign'
  | 'appointments'
  | 'projects'
  | 'classes'
  | 'timetable'
  | 'assignments'
  | 'transport'
  | 'hostel'
  | 'notices'

export type RegisterNeedToggle = {
  id: RegisterNeedId
  label: string
  hint: string
  /** Default checked when this pack is chosen. */
  defaultOn: boolean
  /**
   * When true, the need is always part of the desk (shown checked, not toggleable).
   * Used so users see what they get without cluttering submit.
   */
  locked?: boolean
}

/** Modules turned on when the need is selected (unioned onto the pack). */
const NEED_MODULES: Partial<Record<RegisterNeedId, readonly ModuleFlag[]>> = {
  payroll: ['employees'],
  approvals: ['approvals'],
  pos: ['pos'],
  inventory: ['inventory', 'stores', 'barcodes'],
  purchases: ['purchases', 'vendors', 'bill-payments'],
  multiStore: ['stores', 'inventory'],
  lots: ['inventory', 'stores'],
  discuss: ['discuss'],
  documents: ['documents'],
  calendar: ['calendar'],
  sign: ['sign'],
  appointments: ['appointments'],
  projects: ['projects'],
  // Education desk features ride on sales + documents/calendar already in pack.
  classes: [],
  timetable: ['calendar'],
  assignments: ['documents'],
  transport: [],
  hostel: [],
  notices: ['documents'],
  portal: [],
  tax: [],
}

const BY_PACK: Partial<Record<PackId, readonly RegisterNeedToggle[]>> = {
  school: [
    {
      id: 'classes',
      label: 'Classes, attendance & grades',
      hint: 'Classroom SIS and report cards',
      defaultOn: true,
      locked: true,
    },
    {
      id: 'timetable',
      label: 'Timetable',
      hint: 'Weekly periods per class',
      defaultOn: true,
    },
    {
      id: 'assignments',
      label: 'Assignments',
      hint: 'Practical LMS / homework board',
      defaultOn: true,
    },
    {
      id: 'transport',
      label: 'Transport routes',
      hint: 'Bus routes and riders',
      defaultOn: true,
    },
    {
      id: 'hostel',
      label: 'Hostel beds',
      hint: 'Blocks, rooms, allocations',
      defaultOn: false,
    },
    {
      id: 'notices',
      label: 'Announcements & discipline',
      hint: 'School notices and behaviour records',
      defaultOn: true,
    },
    {
      id: 'portal',
      label: 'Parent portal',
      hint: 'Parents see school home, report cards, invoices',
      defaultOn: true,
    },
    {
      id: 'payroll',
      label: 'Staff payroll',
      hint: 'Teachers and admin payslips',
      defaultOn: true,
    },
    {
      id: 'inventory',
      label: 'Canteen / supplies stock',
      hint: 'Inventory and stores for school supplies',
      defaultOn: false,
    },
    {
      id: 'purchases',
      label: 'Purchases & suppliers',
      hint: 'Bills, POs, and vendor payments',
      defaultOn: false,
    },
    {
      id: 'tax',
      label: 'Tax on fees',
      hint: 'Usually off for schools',
      defaultOn: false,
    },
    {
      id: 'approvals',
      label: 'Maker-checker approvals',
      hint: 'Documents wait for a checker before posting',
      defaultOn: false,
    },
    {
      id: 'discuss',
      label: 'Team chat (Discuss)',
      hint: 'Internal channels for staff',
      defaultOn: false,
    },
    {
      id: 'documents',
      label: 'Documents library',
      hint: 'Policies, files, and uploads',
      defaultOn: true,
    },
    {
      id: 'calendar',
      label: 'School calendar',
      hint: 'Term events and reminders',
      defaultOn: true,
    },
  ],
  university: [
    {
      id: 'classes',
      label: 'Classes, attendance & grades',
      hint: 'Roster, marks, report cards',
      defaultOn: true,
      locked: true,
    },
    {
      id: 'projects',
      label: 'Projects & funds',
      hint: 'Research / fund tracking',
      defaultOn: true,
    },
    {
      id: 'portal',
      label: 'Student / parent portal',
      hint: 'Report cards and fee invoices',
      defaultOn: true,
    },
    {
      id: 'payroll',
      label: 'Staff payroll',
      hint: 'Faculty and admin payslips',
      defaultOn: true,
    },
    {
      id: 'purchases',
      label: 'Purchases & AP',
      hint: 'Vendors, bills, payments',
      defaultOn: true,
    },
    {
      id: 'inventory',
      label: 'Campus stock',
      hint: 'Inventory for supplies',
      defaultOn: false,
    },
    {
      id: 'tax',
      label: 'Tax on tuition',
      hint: 'Usually off',
      defaultOn: false,
    },
    {
      id: 'approvals',
      label: 'Maker-checker approvals',
      hint: 'Checker before posting',
      defaultOn: false,
    },
    {
      id: 'discuss',
      label: 'Team chat',
      hint: 'Staff channels',
      defaultOn: false,
    },
    {
      id: 'documents',
      label: 'Documents library',
      hint: 'Files and policies',
      defaultOn: true,
    },
    {
      id: 'sign',
      label: 'E-sign requests',
      hint: 'Signatures on documents',
      defaultOn: false,
    },
    {
      id: 'calendar',
      label: 'Academic calendar',
      hint: 'Events and reminders',
      defaultOn: true,
    },
  ],
  hospital_admin: [
    {
      id: 'approvals',
      label: 'Approvals on bills',
      hint: 'Maker-checker before posting',
      defaultOn: true,
    },
    {
      id: 'payroll',
      label: 'Staff payroll',
      hint: 'Clinical admin staff payslips',
      defaultOn: true,
    },
    {
      id: 'inventory',
      label: 'Medical supplies stock',
      hint: 'Inventory and stores',
      defaultOn: true,
    },
    {
      id: 'purchases',
      label: 'Purchases & suppliers',
      hint: 'Vendor bills and POs',
      defaultOn: true,
    },
    {
      id: 'pos',
      label: 'Pharmacy / counter POS',
      hint: 'Till for walk-in sales',
      defaultOn: false,
    },
    {
      id: 'lots',
      label: 'Lot / expiry tracking',
      hint: 'Batch-style stock',
      defaultOn: false,
    },
    {
      id: 'portal',
      label: 'Patient portal (AR)',
      hint: 'Invoices and statements for patients',
      defaultOn: false,
    },
    {
      id: 'tax',
      label: 'Sales tax',
      hint: 'Tax on billable services',
      defaultOn: true,
    },
    {
      id: 'documents',
      label: 'Documents library',
      hint: 'Files and forms',
      defaultOn: true,
    },
    {
      id: 'discuss',
      label: 'Team chat',
      hint: 'Staff channels',
      defaultOn: false,
    },
  ],
  retail: [
    { id: 'pos', label: 'Point of Sale till', hint: 'Registers and receipts', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Stock & barcodes', hint: 'Products, stores, labels', defaultOn: true, locked: true },
    { id: 'multiStore', label: 'More than one store', hint: 'Transfers between sites', defaultOn: false },
    { id: 'purchases', label: 'Purchases & suppliers', hint: 'Bills and POs', defaultOn: false },
    { id: 'payroll', label: 'Staff payroll', hint: 'Cashiers and staff', defaultOn: false },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on receipts', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'portal', label: 'Customer portal', hint: 'Invoices online', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Staff channels', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Policies and files', defaultOn: false },
  ],
  restaurant: [
    { id: 'pos', label: 'POS + kitchen', hint: 'Tables and tickets', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Food stock / recipes', hint: 'GROUP items and stock', defaultOn: true },
    { id: 'purchases', label: 'Food suppliers', hint: 'Vendor bills', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll & tips', hint: 'Payslips', defaultOn: true },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on sales', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Floor and kitchen', defaultOn: false },
    { id: 'calendar', label: 'Calendar', hint: 'Events and shifts', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Menus and licenses', defaultOn: false },
  ],
  hotel: [
    { id: 'inventory', label: 'Amenities stock', hint: 'Inventory', defaultOn: true },
    { id: 'pos', label: 'F&B POS', hint: 'Restaurant till', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll', hint: 'Housekeeping and front desk', defaultOn: true },
    { id: 'purchases', label: 'Purchases', hint: 'Suppliers and bills', defaultOn: true },
    { id: 'appointments', label: 'Appointments', hint: 'Bookable slots', defaultOn: false },
    { id: 'tax', label: 'Tax', hint: 'On room and services', defaultOn: true },
    { id: 'portal', label: 'Guest portal', hint: 'Invoices online', defaultOn: false },
    { id: 'sign', label: 'E-sign', hint: 'Document signatures', defaultOn: false },
    { id: 'calendar', label: 'Calendar', hint: 'Occupancy events', defaultOn: true },
    { id: 'discuss', label: 'Team chat', hint: 'Front desk and housekeeping', defaultOn: false },
  ],
  wholesale: [
    { id: 'inventory', label: 'Bulk stock & warehouses', hint: 'Products, stores, transfers', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Purchases & AP', hint: 'Vendors, POs, bills', defaultOn: true, locked: true },
    { id: 'multiStore', label: 'Multi-warehouse', hint: 'Transfers between sites', defaultOn: true },
    { id: 'approvals', label: 'Credit / posting approvals', hint: 'Maker-checker on orders', defaultOn: true },
    { id: 'pos', label: 'Counter POS (optional)', hint: 'Walk-in till', defaultOn: false },
    { id: 'payroll', label: 'Staff payroll', hint: 'Warehouse and office staff', defaultOn: false },
    { id: 'tax', label: 'Sales / purchase tax', hint: 'Tax codes on documents', defaultOn: true },
    { id: 'portal', label: 'Customer portal', hint: 'Orders and invoices online', defaultOn: false },
    { id: 'lots', label: 'Lots / batches', hint: 'Batch-style stock', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Sales and warehouse', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Contracts and files', defaultOn: false },
  ],
  trading: [
    { id: 'inventory', label: 'Stock & products', hint: 'Buy and hold goods', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Purchases & vendors', hint: 'POs, bills, payments', defaultOn: true, locked: true },
    { id: 'pos', label: 'Point of Sale', hint: 'Counter sales', defaultOn: false },
    { id: 'multiStore', label: 'Multi-store', hint: 'Transfers between sites', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll', hint: 'Employees and payslips', defaultOn: true },
    { id: 'tax', label: 'Tax', hint: 'Sales and purchase tax', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'portal', label: 'Customer portal', hint: 'Invoices online', defaultOn: false },
    { id: 'projects', label: 'Projects / jobs', hint: 'Linked sales jobs', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Staff channels', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'File library', defaultOn: false },
  ],
  pharmacy: [
    { id: 'pos', label: 'Pharmacy counter POS', hint: 'Till with lot pick', defaultOn: true, locked: true },
    { id: 'lots', label: 'Lot / expiry registry', hint: 'Controlled and dated stock', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Medicine stock', hint: 'Products and stores', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Suppliers & receive', hint: 'PO with lot + expiry', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll', hint: 'Pharmacists and cashiers', defaultOn: false },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on counter sales', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker on bills', defaultOn: false },
    { id: 'portal', label: 'Customer portal', hint: 'Invoices online', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Licenses and files', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Counter staff', defaultOn: false },
  ],
  ngo: [
    { id: 'projects', label: 'Funds / programmes', hint: 'Grants and fund classes', defaultOn: true, locked: true },
    { id: 'purchases', label: 'AP & suppliers', hint: 'Programme spending', defaultOn: true, locked: true },
    { id: 'documents', label: 'Donor documents', hint: 'Agreements and uploads', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll', hint: 'Programme and admin staff', defaultOn: true },
    { id: 'portal', label: 'Donor / partner portal', hint: 'Statements where enabled', defaultOn: false },
    { id: 'tax', label: 'Tax', hint: 'Usually off for NGOs', defaultOn: false },
    { id: 'approvals', label: 'Spending approvals', hint: 'Maker-checker on bills', defaultOn: true },
    { id: 'discuss', label: 'Team chat', hint: 'Field and HQ', defaultOn: false },
    { id: 'calendar', label: 'Calendar', hint: 'Grant milestones', defaultOn: false },
    { id: 'sign', label: 'E-sign', hint: 'Agreements', defaultOn: false },
    { id: 'inventory', label: 'In-kind / supplies stock', hint: 'Optional inventory', defaultOn: false },
  ],
  professional_services: [
    { id: 'projects', label: 'Projects & time', hint: 'Jobs, WIP, utilization', defaultOn: true, locked: true },
    { id: 'portal', label: 'Client portal', hint: 'Estimates and invoices online', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll', hint: 'Consultants and admin', defaultOn: true },
    { id: 'calendar', label: 'Calendar', hint: 'Client meetings', defaultOn: true },
    { id: 'documents', label: 'Documents', hint: 'Engagement letters', defaultOn: true },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on invoices', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'sign', label: 'E-sign', hint: 'Client signatures', defaultOn: false },
    { id: 'appointments', label: 'Appointments', hint: 'Bookable slots', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Delivery teams', defaultOn: false },
    { id: 'purchases', label: 'Purchases / expenses', hint: 'Vendor bills', defaultOn: false },
  ],
  construction: [
    { id: 'projects', label: 'Jobs & progress billing', hint: 'Contracts, retention, SOV', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Subcontractors & POs', hint: 'Buy and bill', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Site / material stock', hint: 'Stores and issues', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker on progress bills', defaultOn: true },
    { id: 'payroll', label: 'Crew payroll', hint: 'Site and office staff', defaultOn: true },
    { id: 'tax', label: 'Tax', hint: 'On contracts and buys', defaultOn: true },
    { id: 'documents', label: 'Drawings & contracts', hint: 'Document library', defaultOn: false },
    { id: 'sign', label: 'E-sign', hint: 'Change orders', defaultOn: false },
    { id: 'portal', label: 'Customer portal', hint: 'Progress invoices', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Site coordination', defaultOn: false },
    { id: 'calendar', label: 'Calendar', hint: 'Milestones', defaultOn: false },
  ],
  manufacturing: [
    { id: 'inventory', label: 'Materials & finished goods', hint: 'BOM, MRP, stock', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Raw material buys', hint: 'Vendors and POs', defaultOn: true, locked: true },
    { id: 'lots', label: 'Lots / serials', hint: 'Batch tracking', defaultOn: false },
    { id: 'multiStore', label: 'Multi-warehouse', hint: 'Plant and FG stores', defaultOn: true },
    { id: 'payroll', label: 'Shop-floor payroll', hint: 'Operators and staff', defaultOn: false },
    { id: 'tax', label: 'Tax', hint: 'On sales and buys', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'WO / bill checkers', defaultOn: false },
    { id: 'pos', label: 'Counter sales POS', hint: 'Optional till', defaultOn: false },
    { id: 'projects', label: 'Projects', hint: 'Make-to-order jobs', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Production floor', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Specs and SOPs', defaultOn: false },
  ],
  distribution: [
    { id: 'inventory', label: 'WMS / warehouse stock', hint: 'Bins, picks, ASN', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Inbound buys', hint: 'POs and receipts', defaultOn: true, locked: true },
    { id: 'multiStore', label: 'Multi-site warehouses', hint: 'Transfers and waves', defaultOn: true },
    { id: 'lots', label: 'Lots / serials', hint: 'Traceable stock', defaultOn: false },
    { id: 'approvals', label: 'Approvals', hint: 'Checker on movements', defaultOn: false },
    { id: 'payroll', label: 'Warehouse payroll', hint: 'Pickers and clerks', defaultOn: false },
    { id: 'tax', label: 'Tax', hint: 'On sales and buys', defaultOn: true },
    { id: 'pos', label: 'Counter POS', hint: 'Optional till', defaultOn: false },
    { id: 'portal', label: 'Customer portal', hint: 'Order status / invoices', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Warehouse ops', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'ASN and packing files', defaultOn: false },
  ],
  agriculture: [
    { id: 'projects', label: 'Seasons / farms', hint: 'Season as project or class', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Inputs & harvest lots', hint: 'Seed, fertilizer, crop lots', defaultOn: true, locked: true },
    { id: 'purchases', label: 'Input suppliers', hint: 'Buys for the season', defaultOn: true },
    { id: 'lots', label: 'Harvest lot tracking', hint: 'Batch harvest', defaultOn: true },
    { id: 'payroll', label: 'Farm payroll', hint: 'Seasonal and permanent staff', defaultOn: false },
    { id: 'tax', label: 'Tax', hint: 'On sales where applicable', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Spend checkers', defaultOn: false },
    { id: 'portal', label: 'Buyer portal', hint: 'Invoices online', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Land and agreements', defaultOn: false },
    { id: 'calendar', label: 'Season calendar', hint: 'Planting and harvest windows', defaultOn: true },
    { id: 'discuss', label: 'Team chat', hint: 'Farm teams', defaultOn: false },
  ],
  services: [
    { id: 'portal', label: 'Customer portal', hint: 'Invoices and statements', defaultOn: false },
    { id: 'projects', label: 'Jobs / engagements', hint: 'Optional project tracking', defaultOn: false },
    { id: 'payroll', label: 'Staff payroll', hint: 'Service staff', defaultOn: false },
    { id: 'calendar', label: 'Calendar', hint: 'Appointments and visits', defaultOn: true },
    { id: 'appointments', label: 'Bookable appointments', hint: 'Slots for clients', defaultOn: false },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on invoices', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'purchases', label: 'Expenses / vendors', hint: 'Bills and payments', defaultOn: false },
    { id: 'documents', label: 'Documents', hint: 'Contracts and files', defaultOn: false },
    { id: 'sign', label: 'E-sign', hint: 'Client signatures', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Staff channels', defaultOn: false },
  ],
  full: [
    { id: 'pos', label: 'Point of Sale', hint: 'Tills and receipts', defaultOn: true },
    { id: 'inventory', label: 'Inventory & WMS', hint: 'Stock, barcodes, stores', defaultOn: true },
    { id: 'purchases', label: 'Purchases & AP', hint: 'Vendors and bills', defaultOn: true },
    { id: 'projects', label: 'Projects', hint: 'Jobs and costing', defaultOn: true },
    { id: 'payroll', label: 'Payroll / HR', hint: 'Employees and payslips', defaultOn: true },
    { id: 'tax', label: 'Tax', hint: 'Sales and purchase tax', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Maker-checker', defaultOn: true },
    { id: 'portal', label: 'Customer portal', hint: 'Self-service invoices', defaultOn: true },
    { id: 'discuss', label: 'Discuss', hint: 'Team channels', defaultOn: true },
    { id: 'documents', label: 'Documents', hint: 'File library', defaultOn: true },
    { id: 'calendar', label: 'Calendar', hint: 'Meetings', defaultOn: true },
    { id: 'sign', label: 'Sign', hint: 'E-signatures', defaultOn: true },
    { id: 'appointments', label: 'Appointments', hint: 'Bookable slots', defaultOn: true },
  ],
} as const satisfies Record<PackId, readonly RegisterNeedToggle[]>

export function needsForPack(packId: PackId): RegisterNeedToggle[] {
  return [...BY_PACK[packId]]
}

export function defaultNeedsSelection(packId: PackId): Record<RegisterNeedId, boolean> {
  const out = {} as Record<RegisterNeedId, boolean>
  for (const need of needsForPack(packId)) {
    out[need.id] = need.defaultOn
  }
  return out
}

export function parseNeedsFromForm(raw: Record<string, unknown>): RegisterNeedId[] {
  const selected: RegisterNeedId[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith('need_')) continue
    const id = key.slice(5) as RegisterNeedId
    const on = value === true || value === 'true' || value === 'on'
    if (on) selected.push(id)
  }
  return selected
}

/**
 * Start from pack modules, then union modules for selected needs.
 * Locked needs that are off in the form are still applied (desk core).
 */
export function modulesWithNeeds(
  packId: PackId,
  selected: readonly RegisterNeedId[],
): Record<ModuleFlag, boolean> {
  const pack = getPack(packId)
  if (!pack) throw new Error(`Unknown pack: ${packId}`)
  const modules = modulesFromPack(pack)
  const selectedSet = new Set(selected)
  for (const need of needsForPack(packId)) {
    const on = need.locked ? true : selectedSet.has(need.id)
    if (!on) continue
    for (const flag of NEED_MODULES[need.id] ?? []) {
      modules[flag] = true
    }
  }
  // Opt-out: if payroll explicitly off, turn employees off unless pack requires it locked
  const payrollToggle = needsForPack(packId).find((n) => n.id === 'payroll')
  if (payrollToggle && !payrollToggle.locked && !selectedSet.has('payroll')) {
    modules.employees = false
  }
  return modules
}

export function behavioralWithNeeds(
  packId: PackId,
  selected: readonly RegisterNeedId[],
): Partial<
  Pick<
    OrgFeatureFlags,
    'enableTax' | 'enableCustomerPortal' | 'enableDocumentApprovals' | 'payrollStandard'
  >
> {
  const pack = getPack(packId)
  const base = pack?.behavioral ?? {}
  const set = new Set(selected)
  const has = (id: RegisterNeedId) => {
    const def = needsForPack(packId).find((n) => n.id === id)
    if (def?.locked) return true
    return set.has(id)
  }
  return {
    enableTax: has('tax') ? true : (base.enableTax ?? false),
    enableCustomerPortal: has('portal') ? true : (base.enableCustomerPortal ?? false),
    enableDocumentApprovals: has('approvals')
      ? true
      : (base.enableDocumentApprovals ?? false),
    payrollStandard: has('payroll') ? true : (base.payrollStandard ?? false),
  }
}
