/**
 * A code for an imported product whose sheet left SKU blank.
 * Prefer a readable code from the product name; fall back to SKU-00001 style.
 */

/** Sequential fallback when the name cannot make a usable code. */
export function nextBlankSku(takenLower: Iterable<string>): string {
  let max = 0
  for (const sku of takenLower) {
    const match = /^sku-(\d+)$/.exec(sku)
    if (!match) continue
    const n = Number(match[1])
    if (Number.isSafeInteger(n) && n > max) max = n
  }

  let n = max + 1
  const taken = takenLower instanceof Set ? takenLower : new Set(takenLower)
  let candidate = formatBlankSku(n)
  while (taken.has(candidate.toLowerCase())) {
    n += 1
    candidate = formatBlankSku(n)
  }
  return candidate
}

/**
 * Build a SKU from the item name (Excel import with empty SKU column).
 * "Biyo 1.5L" → BIYO-15L; collisions get -2, -3, …
 */
export function skuFromName(name: string, takenLower: Iterable<string>): string {
  const taken = new Set(
    [...(takenLower instanceof Set ? takenLower : takenLower)].map((sku) => sku.toLowerCase()),
  )
  const base = slugifyItemName(name)
  if (!base) return nextBlankSku(taken)

  let candidate = base
  let n = 2
  while (taken.has(candidate.toLowerCase())) {
    const suffix = `-${n}`
    candidate = `${base.slice(0, Math.max(1, 60 - suffix.length))}${suffix}`
    n += 1
    if (n > 9_999) return nextBlankSku(taken)
  }
  return candidate
}

function slugifyItemName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    // Keep "1.5L" as "15L" rather than "1-5L".
    .replace(/\./g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  // Leave room for a uniqueness suffix within the 60-char SKU limit.
  return cleaned.slice(0, 40)
}

function formatBlankSku(n: number): string {
  return `SKU-${String(n).padStart(5, '0')}`
}
