'use client'

import { useEffect } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import {
  FONT_SIZE_KEY,
  FONT_STYLE_KEY,
  parseFontSize,
  parseFontStyle,
} from '@/lib/ui-fonts'

/**
 * Keeps <html data-font-size data-font-style> in sync so every screen
 * (Sales, Banking, Reports, Settings, POS shell) uses the same type.
 */
export function UiFontProvider() {
  const sizeRaw = useBrowserStore(FONT_SIZE_KEY)
  const styleRaw = useBrowserStore(FONT_STYLE_KEY)
  const size = parseFontSize(sizeRaw)
  const style = parseFontStyle(styleRaw)

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', size)
    document.documentElement.setAttribute('data-font-style', style)
  }, [size, style])

  return null
}
