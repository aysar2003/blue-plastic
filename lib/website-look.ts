/**
 * Public website look — separate from the signed-in colour theme.
 * Stored in this browser under WEBSITE_LOOK_KEY; applied as data-website-look on <html>.
 */
export type WebsiteLookId = 'system' | 'brand'

export const WEBSITE_LOOK_KEY = 'bpc.websiteLook'

export type WebsiteLookOption = {
  id: WebsiteLookId
  label: string
  blurb: string
  /** Preview chips: ground, accent, ink. */
  swatches: [string, string, string]
}

export const WEBSITE_LOOKS: WebsiteLookOption[] = [
  {
    id: 'system',
    label: 'Match system',
    blurb: 'Landing and login use the same colours as Appearance → System look (SOM ERP, Odoo, QuickBooks, …).',
    swatches: ['#070b14', '#22d3ee', '#0b1220'],
  },
  {
    id: 'brand',
    label: 'Product website',
    blurb: 'The navy and cyan marketing site — separate from the books desk.',
    swatches: ['#070b14', '#22d3ee', '#0b1220'],
  },
]

/** Default: follow System look — with SOM ERP theme that is the navy/cyan login palette. */
export const DEFAULT_WEBSITE_LOOK: WebsiteLookId = 'system'

export function parseWebsiteLook(raw: string | null | undefined): WebsiteLookId {
  if (raw === 'brand' || raw === 'system') return raw
  return DEFAULT_WEBSITE_LOOK
}
