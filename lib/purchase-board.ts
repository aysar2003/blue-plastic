/** One name, or "-Split-" when a document's lines land in more than one place. */
export function lineLabel(names: Array<string | null | undefined>): string {
  const unique = [
    ...new Set(
      names
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ]
  if (unique.length === 0) return '—'
  if (unique.length === 1) return unique[0] ?? '—'
  return '-Split-'
}
