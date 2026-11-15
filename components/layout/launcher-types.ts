import type { AppGlyphName } from '@/components/layout/app-glyphs'
import type { LauncherIcon } from './launcher-apps'

export type LauncherTile = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  /** When set, the tile is the dark app tile with this flat colour mark. */
  glyph?: AppGlyphName
  accent: string
  wash: string
  blurb?: string
}

export type LauncherInsight = {
  label: string
  value: string
  hint?: string
  href?: string
}

export type LauncherSection = {
  label: string
  blurb?: string
  apps: LauncherTile[]
}
