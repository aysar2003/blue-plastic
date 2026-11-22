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
  ],
  restaurant: [
    { id: 'pos', label: 'POS + kitchen', hint: 'Tables and tickets', defaultOn: true, locked: true },
    { id: 'inventory', label: 'Food stock / recipes', hint: 'GROUP items and stock', defaultOn: true },
    { id: 'purchases', label: 'Food suppliers', hint: 'Vendor bills', defaultOn: true },
    { id: 'payroll', label: 'Staff payroll & tips', hint: 'Payslips', defaultOn: true },
    { id: 'tax', label: 'Sales tax', hint: 'Tax on sales', defaultOn: true },
    { id: 'approvals', label: 'Approvals', hint: 'Checker before posting', defaultOn: false },
    { id: 'discuss', label: 'Team chat', hint: 'Floor and kitchen', defaultOn: false },
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
  ],
}

const FAMILY_FALLBACK: readonly RegisterNeedToggle[] = [
  { id: 'pos', label: 'Point of Sale', hint: 'Till and receipts', defaultOn: false },
  { id: 'inventory', label: 'Inventory & stock', hint: 'Products and warehouses', defaultOn: true },
  { id: 'purchases', label: 'Purchases & AP', hint: 'Vendors and bills', defaultOn: true },
  { id: 'payroll', label: 'Payroll', hint: 'Employees and payslips', defaultOn: false },
  { id: 'tax', label: 'Tax', hint: 'Sales / purchase tax', defaultOn: true },
  { id: 'approvals', label: 'Approvals', hint: 'Maker-checker', defaultOn: false },
  { id: 'portal', label: 'Customer portal', hint: 'Invoices and statements online', defaultOn: false },
  { id: 'projects', label: 'Projects / jobs', hint: 'Job costing and tasks', defaultOn: false },
  { id: 'discuss', label: 'Team chat', hint: 'Internal channels', defaultOn: false },
  { id: 'documents', label: 'Documents', hint: 'File library', defaultOn: false },
  { id: 'calendar', label: 'Calendar', hint: 'Meetings and reminders', defaultOn: false },
  { id: 'sign', label: 'E-sign', hint: 'Signature requests', defaultOn: false },
]

export function needsForPack(packId: PackId): RegisterNeedToggle[] {
  const specific = BY_PACK[packId]
  if (specific) return [...specific]
  return [...FAMILY_FALLBACK]
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
