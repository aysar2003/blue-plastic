export {
  INDUSTRY_PACKS,
  PACK_IDS,
  getPack,
  requirePack,
  listPacksByCategory,
  packsReadyForVertical,
  packsPlannedVertical,
} from './registry'
export {
  modulesFromPack,
  resolveFeatureFlagsFromPack,
  packHasAnyModule,
} from './resolve'
export {
  recommendPackFromAnswers,
  defaultOnboardingAnswers,
  type OnboardingAnswers,
  type PackRecommendation,
} from './recommend'
export {
  institutionCoverage,
  coverageSummary,
  accountingCoverageBullets,
  packStatusLabel,
} from './coverage'
export type {
  PackId,
  PackCategory,
  PackVerticalStatus,
  PackChecklistItem,
  IndustryPack,
  PackInstallOptions,
} from './types'
export type { CoverageRow } from './coverage'
export {
  PACK_FAMILIES,
  packsInFamily,
  familyForPack,
  primaryHubForPack,
  primaryHubKeyForPack,
  workspacePreview,
  suggestedAddOnsForPack,
  verticalLauncherVisible,
  orderHomeAppsForPack,
  assertPackCatalogComplete,
  VERTICAL_LAUNCHER_KEYS,
  type PackFamilyId,
  type PackFamily,
  type PrimaryHub,
  type WorkspacePreview,
} from './workspace'
