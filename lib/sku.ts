/**
 * A code for an imported product whose sheet left SKU blank.
 * Existing codes, including ones already handed out in this file, stay as they are.
 */
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

function formatBlankSku(n: number): string {
  return `SKU-${String(n).padStart(5, '0')}`
}
