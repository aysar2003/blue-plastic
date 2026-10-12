/**
 * Draggable / stylable blocks drawn on top of an uploaded PDF or image template.
 * Positions are percentages of the paper so the layout scales with the preview.
 */

export type OverlayBlockKind = 'text' | 'label' | 'box' | 'field' | 'logo'

export type OverlayBlockStyle = {
  color: string
  background: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  align: 'left' | 'center' | 'right'
  opacity: number
  borderColor: string
  borderWidth: number
  /** How a logo fills its frame. */
  objectFit: 'contain' | 'cover'
}

export type OverlayBlock = {
  id: string
  kind: OverlayBlockKind
  text: string
  /** Left edge, % of paper width. */
  x: number
  /** Top edge, % of paper height. */
  y: number
  /** Width, % of paper width. */
  w: number
  /** Height, % of paper height. */
  h: number
  style: OverlayBlockStyle
  /**
   * IndexedDB key for a logo image blob (same store as template media).
   * Set when kind is `logo`.
   */
  logoKey?: string
}

export type TemplateOverlay = {
  blocks: OverlayBlock[]
}

export const DEFAULT_OVERLAY_STYLE: OverlayBlockStyle = {
  color: '#0f172a',
  background: 'rgba(255,255,255,0.72)',
  fontSize: 14,
  fontWeight: 'normal',
  align: 'left',
  opacity: 1,
  borderColor: '#22d3ee',
  borderWidth: 1,
  objectFit: 'contain',
}

export const OVERLAY_BLOCK_KINDS: { id: OverlayBlockKind; label: string; blurb: string }[] = [
  { id: 'text', label: 'Text', blurb: 'Free text you can drag and restyle.' },
  { id: 'label', label: 'Label', blurb: 'Small heading or field caption.' },
  { id: 'field', label: 'Field', blurb: 'Placeholder like Customer, Total, Date.' },
  { id: 'box', label: 'Box', blurb: 'Highlight or frame an area on the paper.' },
  { id: 'logo', label: 'Logo', blurb: 'Company or uploaded logo — drag and resize.' },
]

/** IndexedDB key for a logo image attached to an overlay block. */
export function overlayLogoStorageKey(templateId: string, blockId: string) {
  return `${templateId}::logo::${blockId}`
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function newOverlayBlockId() {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function createOverlayBlock(
  kind: OverlayBlockKind,
  partial?: Partial<OverlayBlock>,
): OverlayBlock {
  const defaults: Record<OverlayBlockKind, Pick<OverlayBlock, 'text' | 'w' | 'h' | 'style'>> = {
    text: {
      text: 'New text',
      w: 28,
      h: 8,
      style: { ...DEFAULT_OVERLAY_STYLE },
    },
    label: {
      text: 'Label',
      w: 20,
      h: 6,
      style: {
        ...DEFAULT_OVERLAY_STYLE,
        fontWeight: 'bold',
        fontSize: 12,
        background: 'transparent',
        borderWidth: 0,
      },
    },
    field: {
      text: '{{Customer}}',
      w: 32,
      h: 7,
      style: {
        ...DEFAULT_OVERLAY_STYLE,
        color: '#0e7490',
        borderColor: '#0e7490',
        background: 'rgba(34,211,238,0.12)',
      },
    },
    box: {
      text: '',
      w: 36,
      h: 16,
      style: {
        ...DEFAULT_OVERLAY_STYLE,
        background: 'rgba(34,211,238,0.08)',
        borderColor: '#22d3ee',
        borderWidth: 2,
        color: '#0f172a',
      },
    },
    logo: {
      text: 'Logo',
      w: 18,
      h: 12,
      style: {
        ...DEFAULT_OVERLAY_STYLE,
        background: 'rgba(255,255,255,0.9)',
        borderColor: '#94a3b8',
        borderWidth: 1,
        objectFit: 'contain',
      },
    },
  }

  const base = defaults[kind]
  const id = partial?.id ?? newOverlayBlockId()
  return {
    id,
    kind,
    text: partial?.text ?? base.text,
    x: clamp(partial?.x ?? 8, 0, 95),
    y: clamp(partial?.y ?? 8, 0, 95),
    w: clamp(partial?.w ?? base.w, 4, 100),
    h: clamp(partial?.h ?? base.h, 3, 100),
    style: { ...base.style, ...partial?.style },
    logoKey: partial?.logoKey,
  }
}

export function parseTemplateOverlay(raw: unknown): TemplateOverlay {
  if (!raw || typeof raw !== 'object') return { blocks: [] }
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.blocks)) return { blocks: [] }

  const blocks = data.blocks.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const item = row as Record<string, unknown>
    const kind = OVERLAY_BLOCK_KINDS.some((entry) => entry.id === item.kind)
      ? (item.kind as OverlayBlockKind)
      : null
    const id = typeof item.id === 'string' ? item.id.slice(0, 40) : ''
    if (!kind || !id) return []
    const styleRaw = item.style && typeof item.style === 'object' ? (item.style as Record<string, unknown>) : {}
    const style: OverlayBlockStyle = {
      color: typeof styleRaw.color === 'string' ? styleRaw.color.slice(0, 40) : DEFAULT_OVERLAY_STYLE.color,
      background:
        typeof styleRaw.background === 'string'
          ? styleRaw.background.slice(0, 80)
          : DEFAULT_OVERLAY_STYLE.background,
      fontSize:
        typeof styleRaw.fontSize === 'number'
          ? clamp(styleRaw.fontSize, 8, 72)
          : DEFAULT_OVERLAY_STYLE.fontSize,
      fontWeight: styleRaw.fontWeight === 'bold' ? 'bold' : 'normal',
      align:
        styleRaw.align === 'center' || styleRaw.align === 'right' || styleRaw.align === 'left'
          ? styleRaw.align
          : 'left',
      opacity:
        typeof styleRaw.opacity === 'number' ? clamp(styleRaw.opacity, 0.1, 1) : DEFAULT_OVERLAY_STYLE.opacity,
      borderColor:
        typeof styleRaw.borderColor === 'string'
          ? styleRaw.borderColor.slice(0, 40)
          : DEFAULT_OVERLAY_STYLE.borderColor,
      borderWidth:
        typeof styleRaw.borderWidth === 'number'
          ? clamp(styleRaw.borderWidth, 0, 8)
          : DEFAULT_OVERLAY_STYLE.borderWidth,
      objectFit: styleRaw.objectFit === 'cover' ? 'cover' : 'contain',
    }
    const logoKey = typeof item.logoKey === 'string' ? item.logoKey.slice(0, 120) : undefined
    return [
      {
        id,
        kind,
        text: typeof item.text === 'string' ? item.text.slice(0, 500) : '',
        x: clamp(typeof item.x === 'number' ? item.x : 0, 0, 100),
        y: clamp(typeof item.y === 'number' ? item.y : 0, 0, 100),
        w: clamp(typeof item.w === 'number' ? item.w : 20, 4, 100),
        h: clamp(typeof item.h === 'number' ? item.h : 6, 3, 100),
        style,
        logoKey: kind === 'logo' ? logoKey : undefined,
      },
    ]
  })

  return { blocks: blocks.slice(0, 60) }
}

export function moveOverlayBlock(block: OverlayBlock, x: number, y: number): OverlayBlock {
  return {
    ...block,
    x: clamp(x, 0, 100 - block.w),
    y: clamp(y, 0, 100 - block.h),
  }
}

export function resizeOverlayBlock(block: OverlayBlock, w: number, h: number): OverlayBlock {
  return {
    ...block,
    w: clamp(w, 4, 100 - block.x),
    h: clamp(h, 3, 100 - block.y),
  }
}
