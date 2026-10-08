/**
 * International trade product categories for a general merchant / building-supply
 * organisation. Names follow common UNSPSC / retail merchandising groupings so
 * the catalogue does not look improvised.
 *
 * Seeded once per organisation; existing custom names are left alone.
 */
export const STANDARD_ITEM_CATEGORIES = [
  'Building materials',
  'Plumbing',
  'Electrical',
  'Electronics',
  'Hardware',
  'Tools',
  'Paint and finishing',
  'HVAC',
  'Safety and PPE',
  'Fasteners',
  'Timber and wood',
  'Cement and concrete',
  'Roofing',
  'Doors and windows',
  'Tiles and flooring',
  'Sanitary ware',
  'Lighting',
  'Cables and wiring',
  'Pipes and fittings',
  'General merchandise',
] as const

export type StandardCategoryName = (typeof STANDARD_ITEM_CATEGORIES)[number]
