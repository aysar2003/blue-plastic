/**
 * Per-layout look overrides saved in the browser from Settings → Templates.
 * Used for View/Edit previews; sales screens keep their structural layout id.
 */

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
}

export const TEMPLATE_LOOK_FONTS = [
  { id: 'ui-sans-serif, system-ui, sans-serif', label: 'System' },
  { id: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { id: '"Courier New", Courier, monospace', label: 'Mono' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { id: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
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
}

export function templateLookStorageKey(catalogKey: string, layoutId: string) {
  return `bpc.templateLook.${catalogKey}.${layoutId}`
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
    return base
  } catch {
    return base
  }
}

export function serializeTemplateLook(look: TemplateLook): string {
  return JSON.stringify(look)
}
