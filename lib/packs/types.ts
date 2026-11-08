import type {
  DocumentKindsFlags,
  ModuleFlag,
  OrgFeatureFlags,
} from '@/lib/feature-flags'

/** Stable pack ids — used in DB `Organization.installedPackId` and onboarding later. */
export type PackId =
  | 'retail'
  | 'wholesale'
  | 'trading'
  | 'restaurant'
  | 'hotel'
  | 'pharmacy'
  | 'school'
  | 'university'
  | 'hospital_admin'
  | 'ngo'
  | 'professional_services'
  | 'construction'
  | 'manufacturing'
  | 'distribution'
  | 'services'
  | 'full'

export type PackCategory =
  | 'trading'
  | 'hospitality'
  | 'health'
  | 'education'
  | 'services'
  | 'operations'
  | 'general'

/**
 * `ready` — module preset + vertical domain features are shippable.
 * `planned` — module preset is installable; vertical domain work is still outstanding.
 */
export type PackVerticalStatus = 'ready' | 'planned'

export type PackChecklistItem = {
  id: string
  label: string
  href: string
}

export type IndustryPack = {
  id: PackId
  label: string
  blurb: string
  category: PackCategory
  verticalStatus: PackVerticalStatus
  /** Apps turned on by this pack. All other module flags are turned off. */
  enabledModules: readonly ModuleFlag[]
  /** Optional slim document kinds; omitted families stay default (all on). */
  documentKinds?: Partial<{
    sales: Partial<DocumentKindsFlags['sales']>
    purchases: Partial<DocumentKindsFlags['purchases']>
    inventory: Partial<DocumentKindsFlags['inventory']>
  }>
  behavioral?: Partial<
    Pick<
      OrgFeatureFlags,
      | 'enableTax'
      | 'enableCustomerPortal'
      | 'enableDocumentApprovals'
      | 'payrollStandard'
      | 'creditLimitWarn'
      | 'closeHardGates'
    >
  >
  setupChecklist: readonly PackChecklistItem[]
  inScope: readonly string[]
  outOfScope: readonly string[]
  seedChartDefault: boolean
}

export type PackInstallOptions = {
  /** When true, seed default CoA if the org has no ledger accounts yet. */
  seedChart?: boolean
  /**
   * When true (system-owner / Databases), grants match the pack modules.
   * When false (future company self-serve), modules are clamped to existing grants.
   */
  replaceGrants?: boolean
}
