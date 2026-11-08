/** Build the Back / Forward hrefs for a typed document list that ends at /new. */
export function neighborHrefs(
  base: string,
  neighbors: {
    previous: { id: string; number: string } | null
    next: { id: string; number: string } | null
  } | null | undefined,
  recordId: string | undefined,
  editSuffix = '/edit',
): {
  previousHref: string | null
  forwardHref: string | null
  previousTitle: string
  forwardTitle: string
} {
  const previous = neighbors?.previous ?? null
  const next = neighbors?.next ?? null
  const previousHref = previous ? `${base}/${previous.id}${editSuffix}` : null
  const forwardHref = next
    ? `${base}/${next.id}${editSuffix}`
    : recordId
      ? `${base}/new`
      : null

  return {
    previousHref,
    forwardHref,
    previousTitle: previous
      ? `Back to ${previous.number}`
      : 'No earlier record',
    forwardTitle: next
      ? `Forward to ${next.number}`
      : recordId
        ? 'Forward to a new form'
        : 'No later record',
  }
}
