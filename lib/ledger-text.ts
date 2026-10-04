/**
 * A posted line often stores one sentence that is really two facts:
 * the kind of entry ("Opening balance") and who it was for ("UNION GROUP").
 * The register and the account report show those as separate columns.
 */
export function postedLineParts(input: {
  sourceLabel: string
  memo: string | null
  description: string | null
  partyName: string | null
}): { name: string | null; note: string | null } {
  const party = text(input.partyName)
  const raw = text(input.description) ?? text(input.memo)
  if (!raw) return { name: party, note: null }

  const prefix = `${input.sourceLabel} — `
  if (raw === input.sourceLabel) return { name: party, note: null }
  if (raw.startsWith(prefix)) {
    const rest = raw
      .slice(prefix.length)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim()
    return { name: party ?? (rest || null), note: null }
  }
  if (party && raw === party) return { name: party, note: null }
  return { name: party, note: raw }
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
