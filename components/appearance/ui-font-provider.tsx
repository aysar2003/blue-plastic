'use client'

import { useEffect } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import {
  FONT_SIZE_KEY,
  FONT_SIZE_PX_KEY,
  FONT_STYLE_CUSTOM_KEY,
  FONT_STYLE_KEY,
  fontFamilyForStyle,
  parseFontSize,
  parseFontSizePx,
  parseFontStyle,
  parseFontStyleCustom,
} from '@/lib/ui-fonts'

/**
 * Keeps <html data-font-size data-font-style> in sync so every screen
 * (Sales, Banking, Reports, Settings, POS shell) uses the same type.
 * Custom size → --ui-font-px; custom style → --ui-font-family.
 */
export function UiFontProvider() {
  const sizeRaw = useBrowserStore(FONT_SIZE_KEY)
  const styleRaw = useBrowserStore(FONT_STYLE_KEY)
  const sizePxRaw = useBrowserStore(FONT_SIZE_PX_KEY)
  const customStyleRaw = useBrowserStore(FONT_STYLE_CUSTOM_KEY)
  const size = parseFontSize(sizeRaw)
  const style = parseFontStyle(styleRaw)
  const sizePx = parseFontSizePx(sizePxRaw)
  const customStack = parseFontStyleCustom(customStyleRaw)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-font-size', size)
    root.setAttribute('data-font-style', style)
    if (size === 'custom') {
      root.style.setProperty('--ui-font-px', `${sizePx}px`)
    } else {
      root.style.removeProperty('--ui-font-px')
    }
    if (style === 'custom') {
      root.style.setProperty('--ui-font-family', customStack)
    } else {
      const family = fontFamilyForStyle(style)
      if (family) root.style.setProperty('--ui-font-family', family)
      else root.style.removeProperty('--ui-font-family')
    }
  }, [size, style, sizePx, customStack])

  return null
}
