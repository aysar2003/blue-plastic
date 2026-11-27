/** Clerk-set reorder points (including zero) are never replaced by heal. */
export function shouldHealReorderPoint(
  current: { toString(): string } | string | number | null | undefined,
): boolean {
  if (current == null) return true
  if (typeof current === 'string' && current.trim() === '') return true
  return false
}

export type SetupHealthGapRow = {
  kind: string
  name: string
  sku?: string | null
  id?: string | null
  detail: string
}

export const SETUP_HEALTH_GAP_HEADERS = ['Kind', 'Name', 'SKU', 'Id', 'Detail'] as const

export const SETUP_HEALTH_GAP_KINDS = [
  'org_missing_country',
  'item_missing_sku',
  'stock_missing_reorder',
  'item_missing_tax',
  'customer_missing_country',
] as const

export type SetupHealthGapKind = (typeof SETUP_HEALTH_GAP_KINDS)[number]

/** Rough aisle / prefix bucket from the product name (heal workbook analysis). */
export function categorizeHealItemName(name: string): string {
  const n = name.toUpperCase()
  if (/AIR.?CONDITION|R22|R410|HVAC|SPLIT\s*\d|\bAC\b/.test(n)) return 'HVAC / AC'
  if (/VALVE|PIPE|PLUMB|FAUCET|TAP|ELBOW|TEE\b|NIPPLE|UNION|COUPLING|GASKET|HOSE|FITTING/.test(n)) {
    return 'Plumbing / Pipes'
  }
  if (/WIRE|CABLE|SWITCH|SOCKET|JUNCTION|BREAKER|CONDUIT|ELECTR|BULB|LAMP|LED|CEILING/.test(n)) {
    return 'Electrical'
  }
  if (/WELD|GRIND|DRILL|CUTTER|TOOL|COMPRESSOR|COMPOSOR|MACHINE|PUMP/.test(n)) {
    return 'Tools / Machines'
  }
  if (/PAPER|A4|PEN|OFFICE|FILE|TONER|INK/.test(n)) return 'Office Supplies'
  if (/BOLT|NUT|SCREW|BRACKET|CLAMP|NAIL|FASTENER|ANCHOR|GLUE|ADHESIVE|TAPE/.test(n)) {
    return 'Hardware / Fasteners'
  }
  if (/PAINT|THINNER|CEMENT|TILE|BOARD|GYPSUM|STEEL|IRON|SHEET|ANGLE|WOOD/.test(n)) {
    return 'Building Materials'
  }
  return 'Other'
}
