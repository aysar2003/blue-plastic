/**
 * Per-layout look overrides saved in the browser from Settings → Templates.
 * Used for View/Edit previews; sales screens keep their structural layout id.
 */

export type TemplateLookHeaderStyle = 'band' | 'line' | 'plain'
export type TemplateLookDensity = 'comfortable' | 'compact'

export type TemplateLook = {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  accent: string
  borderColor: string
  borderWidth: number
  showLogo: boolean
  /** Optional short header label on the preview. */
  title: string
  headerStyle: TemplateLookHeaderStyle
  density: TemplateLookDensity
  /** Corner radius on the paper frame (px). */
  radius: number
  showBanks: boolean
  showTerms: boolean
  /** Last preset applied, when the user picked one from the style gallery. */
  presetId: string
}

export const TEMPLATE_LOOK_FONTS = [
  { id: 'ui-sans-serif, system-ui, sans-serif', label: 'System' },
  { id: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { id: '"Courier New", Courier, monospace', label: 'Mono' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { id: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
] as const

export type TemplateLookPresetId =
  | 'professional'
  | 'modern'
  | 'minimal'
  | 'classic'
  | 'bold'

export type TemplateLookPreset = {
  id: TemplateLookPresetId
  label: string
  blurb: string
  /** Partial look applied on top of defaults (accent kept unless set). */
  look: Partial<TemplateLook>
}

export const TEMPLATE_LOOK_PRESETS: readonly TemplateLookPreset[] = [
  {
    id: 'professional',
    label: 'Professional',
    blurb: 'Clean header line, balanced type, soft border.',
    look: {
      fontFamily: TEMPLATE_LOOK_FONTS[0].id,
      fontSize: 14,
      fontWeight: 'normal',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      headerStyle: 'line',
      density: 'comfortable',
      radius: 8,
      showLogo: true,
      showBanks: true,
      showTerms: true,
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    blurb: 'Coloured band header, roomy spacing, rounded frame.',
    look: {
      fontFamily: TEMPLATE_LOOK_FONTS[0].id,
      fontSize: 14,
      fontWeight: 'normal',
      borderColor: '#e2e8f0',
      borderWidth: 0,
      headerStyle: 'band',
      density: 'comfortable',
      radius: 12,
      showLogo: true,
      showBanks: true,
      showTerms: true,
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    blurb: 'No border noise — title and totals only.',
    look: {
      fontFamily: TEMPLATE_LOOK_FONTS[0].id,
      fontSize: 13,
      fontWeight: 'normal',
      borderColor: '#f1f5f9',
      borderWidth: 0,
      headerStyle: 'plain',
      density: 'compact',
      radius: 4,
      showLogo: false,
      showBanks: false,
      showTerms: true,
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'Serif type, firm border, traditional line header.',
    look: {
      fontFamily: TEMPLATE_LOOK_FONTS[1].id,
      fontSize: 15,
      fontWeight: 'normal',
      borderColor: '#94a3b8',
      borderWidth: 2,
      headerStyle: 'line',
      density: 'comfortable',
      radius: 0,
      showLogo: true,
      showBanks: true,
      showTerms: true,
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    blurb: 'Strong type, thick accent band, high contrast.',
    look: {
      fontFamily: TEMPLATE_LOOK_FONTS[3].id,
      fontSize: 16,
      fontWeight: 'bold',
      borderColor: '#64748b',
      borderWidth: 3,
      headerStyle: 'band',
      density: 'comfortable',
      radius: 6,
      showLogo: true,
      showBanks: true,
      showTerms: true,
    },
  },
] as const

export const DEFAULT_TEMPLATE_LOOK: TemplateLook = {
  fontFamily: TEMPLATE_LOOK_FONTS[0].id,
  fontSize: 14,
  fontWeight: 'normal',
  accent: '#1eb8ae',
  borderColor: '#cbd5e1',
  borderWidth: 1,
  showLogo: true,
  title: '',
  headerStyle: 'line',
  density: 'comfortable',
  radius: 8,
  showBanks: true,
  showTerms: true,
  presetId: 'professional',
}

export function templateLookStorageKey(catalogKey: string, layoutId: string) {
  return `bpc.templateLook.${catalogKey}.${layoutId}`
}

export function applyTemplateLookPreset(
  presetId: TemplateLookPresetId | string,
  current: TemplateLook,
): TemplateLook {
  const preset = TEMPLATE_LOOK_PRESETS.find((row) => row.id === presetId)
  if (!preset) return current
  return {
    ...current,
    ...preset.look,
    accent: current.accent,
    title: current.title,
    presetId: preset.id,
  }
}

export function parseTemplateLook(raw: string | null | undefined, fallbackAccent?: string): TemplateLook {
  const base: TemplateLook = {
    ...DEFAULT_TEMPLATE_LOOK,
    accent: fallbackAccent && /^#[0-9a-fA-F]{6}$/.test(fallbackAccent) ? fallbackAccent : DEFAULT_TEMPLATE_LOOK.accent,
  }
  if (!raw) return base
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (typeof data.fontFamily === 'string' && data.fontFamily.trim()) {
      base.fontFamily = data.fontFamily.trim().slice(0, 120)
    }
    if (typeof data.fontSize === 'number') {
      base.fontSize = Math.min(28, Math.max(10, Math.round(data.fontSize)))
    }
    if (data.fontWeight === 'bold' || data.fontWeight === 'normal') base.fontWeight = data.fontWeight
    if (typeof data.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.accent)) base.accent = data.accent
    if (typeof data.borderColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.borderColor)) {
      base.borderColor = data.borderColor
    }
    if (typeof data.borderWidth === 'number') {
      base.borderWidth = Math.min(8, Math.max(0, Math.round(data.borderWidth)))
    }
    if (typeof data.showLogo === 'boolean') base.showLogo = data.showLogo
    if (typeof data.title === 'string') base.title = data.title.trim().slice(0, 40)
    if (data.headerStyle === 'band' || data.headerStyle === 'line' || data.headerStyle === 'plain') {
      base.headerStyle = data.headerStyle
    }
    if (data.density === 'comfortable' || data.density === 'compact') base.density = data.density
    if (typeof data.radius === 'number') {
      base.radius = Math.min(24, Math.max(0, Math.round(data.radius)))
    }
    if (typeof data.showBanks === 'boolean') base.showBanks = data.showBanks
    if (typeof data.showTerms === 'boolean') base.showTerms = data.showTerms
    if (typeof data.presetId === 'string' && data.presetId.trim()) {
      base.presetId = data.presetId.trim().slice(0, 40)
    }
    return base
  } catch {
    return base
  }
}

export function serializeTemplateLook(look: TemplateLook): string {
  return JSON.stringify(look)
}
