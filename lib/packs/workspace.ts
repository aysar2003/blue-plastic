/**
 * Pack → workspace contract for ERP-standard selection (register + home).
 * Pure / no I/O — safe for client and server.
 */
import { ERP_READY_LOOPS } from '@/lib/erp/readiness'
import type { ModuleFlag } from '@/lib/feature-flags'

import { getPack, INDUSTRY_PACKS } from './registry'
import type { IndustryPack, PackId } from './types'

export type PackFamilyId =
  | 'trade'
  | 'food_stay'
  | 'health'
  | 'education'
  | 'services'
  | 'make_move'
  | 'everything'

export type PackFamily = {
  id: PackFamilyId
  label: string
  hint: string
  packIds: readonly PackId[]
}

/** Screen 1 — industry families (progressive disclosure into 17 packs). */
export const PACK_FAMILIES: readonly PackFamily[] = [
  {
    id: 'trade',
    label: 'Trade & shops',
    hint: 'Retail, wholesale, and general trading',
    packIds: ['retail', 'wholesale', 'trading'],
  },
  {
    id: 'food_stay',
    label: 'Food & stay',
    hint: 'Restaurants, cafes, hotels',
    packIds: ['restaurant', 'hotel'],
  },
  {
    id: 'health',
    label: 'Health',
    hint: 'Pharmacy counter and hospital billing',
    packIds: ['pharmacy', 'hospital_admin'],
  },
  {
    id: 'education',
    label: 'Education',
    hint: 'Schools and universities — fees and academics',
    packIds: ['school', 'university'],
  },
  {
    id: 'services',
    label: 'Services & nonprofit',
    hint: 'Professional firms, general services, NGO',
    packIds: ['professional_services', 'services', 'ngo'],
  },
  {
    id: 'make_move',
    label: 'Make & move',
    hint: 'Manufacturing, warehouse, construction, farms',
    packIds: ['manufacturing', 'distribution', 'construction', 'agriculture'],
  },
  {
    id: 'everything',
    label: 'Everything',
    hint: 'Full ERP — turn almost every app on',
    packIds: ['full'],
  },
] as const

export type PrimaryHub = {
  key: string
  label: string
  href: string
  blurb: string
}

const HUB_BY_PACK: Record<PackId, PrimaryHub> = {
  retail: { key: 'pos', label: 'Point of Sale', href: '/pos', blurb: 'Till and receipts' },
  wholesale: { key: 'sales', label: 'Sales', href: '/sales', blurb: 'Orders and invoices' },
  trading: { key: 'sales', label: 'Sales', href: '/sales', blurb: 'Buy and sell goods' },
  restaurant: { key: 'pos', label: 'Point of Sale', href: '/pos', blurb: 'Tables and kitchen' },
  hotel: {
    key: 'hospitality',
    label: 'Hospitality',
    href: '/hospitality',
    blurb: 'Rooms, stays, and folio',
  },
  pharmacy: { key: 'pos', label: 'Point of Sale', href: '/pos', blurb: 'Counter and lots' },
  school: {
    key: 'education',
    label: 'Education',
    href: '/education',
    blurb: 'Fees, classes, and school desk',
  },
  university: {
    key: 'education',
    label: 'Education',
    href: '/education',
    blurb: 'Tuition, classes, and grades',
  },
  hospital_admin: {
    key: 'hospital',
    label: 'Hospital',
    href: '/hospital',
    blurb: 'Visits, charges, and claims',
  },
  ngo: { key: 'customers', label: 'Customers / funds', href: '/ngo', blurb: 'Donors and grants' },
  professional_services: {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    blurb: 'Jobs and invoices',
  },
  construction: {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    blurb: 'Jobs and retention',
  },
  manufacturing: {
    key: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    blurb: 'BOM, work orders, MRP',
  },
  distribution: {
    key: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    blurb: 'Warehouse and picks',
  },
  agriculture: {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    blurb: 'Seasons and harvest',
  },
  services: { key: 'sales', label: 'Sales', href: '/sales', blurb: 'Service invoices' },
  full: { key: 'dashboard', label: 'Apps home', href: '/dashboard', blurb: 'All company apps' },
}

/** Suggested Marketplace add-ons (module flags not already in the pack). */
const ADDONS_BY_PACK: Partial<Record<PackId, readonly ModuleFlag[]>> = {
  school: ['inventory', 'stores', 'purchases', 'vendors', 'discuss'],
  university: ['inventory', 'discuss', 'sign'],
  hospital_admin: ['pos', 'inventory', 'stores'],
  retail: ['employees', 'approvals', 'discuss'],
  wholesale: ['pos', 'approvals', 'barcodes'],
  trading: ['pos', 'approvals', 'employees'],
  restaurant: ['approvals', 'discuss', 'sign'],
  hotel: ['approvals', 'sign', 'appointments'],
  pharmacy: ['approvals', 'employees'],
  ngo: ['projects', 'documents', 'discuss'],
  professional_services: ['sign', 'discuss', 'approvals'],
  construction: ['approvals', 'documents', 'sign'],
  manufacturing: ['approvals', 'employees'],
  distribution: ['approvals', 'barcodes'],
  agriculture: ['inventory', 'stores'],
  services: ['projects', 'employees'],
  full: [],
}

export function familyForPack(packId: PackId): PackFamily | null {
  return PACK_FAMILIES.find((family) => family.packIds.includes(packId)) ?? null
}

export function packsInFamily(familyId: PackFamilyId): IndustryPack[] {
  const family = PACK_FAMILIES.find((row) => row.id === familyId)
  if (!family) return []
  return family.packIds
    .map((id) => getPack(id))
    .filter((pack): pack is IndustryPack => pack != null)
}

export function primaryHubForPack(packId: PackId): PrimaryHub {
  return HUB_BY_PACK[packId] ?? HUB_BY_PACK.full
}

export function primaryHubKeyForPack(packId: string | null | undefined): string | null {
  if (!packId) return null
  const pack = getPack(packId)
  if (!pack) return null
  return primaryHubForPack(pack.id).key
}

export type WorkspaceLoop = {
  id: string
  title: string
}

export type WorkspacePreview = {
  packId: PackId
  packLabel: string
  blurb: string
  hub: PrimaryHub
  daily: string[]
  underlyingLoops: WorkspaceLoop[]
  outOfScope: string[]
  suggestedAddOns: ModuleFlag[]
  checklistCount: number
}

function loopsForModules(modules: readonly ModuleFlag[]): WorkspaceLoop[] {
  const enabled = new Set<string>(modules)
  const loops: WorkspaceLoop[] = []
  for (const loop of ERP_READY_LOOPS) {
    if (loop.id === 'marketplace' || loop.id === 'institutions') continue
    const hit = loop.apps.some((app) => app === 'portal' || enabled.has(app as ModuleFlag))
    if (hit) {
      loops.push({ id: loop.id, title: loop.title.split(' (')[0] ?? loop.title })
    }
  }
  return loops
}

export function workspacePreview(packId: PackId): WorkspacePreview | null {
  const pack = getPack(packId)
  if (!pack) return null
  const enabled = new Set(pack.enabledModules)
  const addOns = (ADDONS_BY_PACK[pack.id] ?? []).filter((flag) => !enabled.has(flag))
  return {
    packId: pack.id,
    packLabel: pack.label,
    blurb: pack.blurb,
    hub: primaryHubForPack(pack.id),
    daily: [...pack.inScope].slice(0, 10),
    underlyingLoops: loopsForModules(pack.enabledModules),
    outOfScope: [...pack.outOfScope],
    suggestedAddOns: [...addOns],
    checklistCount: pack.setupChecklist.length,
  }
}

export function suggestedAddOnsForPack(packId: string | null | undefined): ModuleFlag[] {
  if (!packId) return []
  const pack = getPack(packId)
  if (!pack) return []
  const enabled = new Set(pack.enabledModules)
  return (ADDONS_BY_PACK[pack.id] ?? []).filter((flag) => !enabled.has(flag))
}

/** Vertical launcher keys that only appear for matching packs. */
export const VERTICAL_LAUNCHER_KEYS = ['education', 'hospital', 'hospitality'] as const

export function verticalLauncherVisible(
  launcherKey: string,
  packId: string | null | undefined,
): boolean {
  if (!VERTICAL_LAUNCHER_KEYS.includes(launcherKey as (typeof VERTICAL_LAUNCHER_KEYS)[number])) {
    return true
  }
  if (!packId) return false
  const hub = primaryHubKeyForPack(packId)
  return hub === launcherKey
}

/**
 * Put the pack primary hub first, then keep the usual home order for the rest.
 */
export function orderHomeAppsForPack<T extends { key: string }>(
  apps: readonly T[],
  packId: string | null | undefined,
  baseOrder: (apps: readonly T[]) => T[],
): T[] {
  const ordered = baseOrder(apps)
  const hubKey = primaryHubKeyForPack(packId)
  if (!hubKey || hubKey === 'dashboard') return ordered
  const hub = ordered.find((app) => app.key === hubKey)
  if (!hub) return ordered
  return [hub, ...ordered.filter((app) => app.key !== hubKey)]
}

export function assertPackCatalogComplete(): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = []
  for (const pack of INDUSTRY_PACKS) {
    if (!HUB_BY_PACK[pack.id]) missing.push(`${pack.id}:hub`)
    if (pack.setupChecklist.length === 0) missing.push(`${pack.id}:checklist`)
    if (pack.enabledModules.length === 0) missing.push(`${pack.id}:modules`)
  }
  for (const family of PACK_FAMILIES) {
    for (const id of family.packIds) {
      if (!getPack(id)) missing.push(`family:${family.id}:${id}`)
    }
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
