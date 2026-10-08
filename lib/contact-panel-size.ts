/**
 * Sizes for the Customers / Vendors centre: how tall the whole panel is, and
 * how much of the detail pane the "information" block may take before the
 * transactions table gets the rest. Pure, so it can be tested without a DOM.
 */

/** The panel never gets shorter than this, nor taller than this. */
export const FRAME_MIN = 320
export const FRAME_MAX = 2400
/** On a short screen the panel still gets about a screenful (1024×576 laptops). */
export const FRAME_COMFORT = 560

/** The information block keeps at least its title row. */
export const PROFILE_MIN = 44
/** Tabs, filters, a few rows and the footer always keep this much. */
export const TABLE_MIN = 200
/** Share of the pane the information block takes until it is dragged. */
export const PROFILE_SHARE = 0.3

export function clampFrameHeight(height: number): number {
  return Math.round(Math.min(FRAME_MAX, Math.max(FRAME_MIN, height)))
}

/**
 * Fill the window from the panel's top down; on a short window, where that
 * would leave a sliver, take about a screenful instead (the page scrolls a
 * little to show the rest, and the table scrolls inside).
 */
export function defaultFrameHeight(viewportHeight: number, top: number): number {
  const fill = viewportHeight - top - 12
  const screenful = Math.min(FRAME_COMFORT, viewportHeight - 16)
  return clampFrameHeight(Math.max(fill, screenful))
}

export function clampProfileHeight(height: number, pane: number): number {
  const max = Math.max(PROFILE_MIN, pane - TABLE_MIN)
  return Math.round(Math.min(max, Math.max(PROFILE_MIN, height)))
}

export function defaultProfileHeight(pane: number): number {
  return clampProfileHeight(pane * PROFILE_SHARE, pane)
}

/** A remembered height, or null when nothing (or nonsense) is stored. */
export function parseStoredHeight(raw: string | null): number | null {
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export const panelHeightKey = (side: 'customer' | 'vendor') => `contact-panel:v1:height:${side}`
export const profileHeightKey = (side: 'customer' | 'vendor') => `contact-panel:v1:profile:${side}`
