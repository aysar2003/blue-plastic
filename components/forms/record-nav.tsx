'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * QuickBooks-style Back / Forward between saved records of one document type.
 *
 * Back opens the previous saved row (or the newest when the form is blank).
 * Forward opens the next row, or a blank /new form when standing on the newest.
 */
export function RecordNav({
  previousHref,
  forwardHref,
  previousTitle,
  forwardTitle,
}: {
  previousHref: string | null
  forwardHref: string | null
  previousTitle?: string
  forwardTitle?: string
}) {
  const router = useRouter()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!previousHref}
        title={previousTitle ?? (previousHref ? 'Back to previous record' : 'No earlier record')}
        onClick={() => previousHref && router.push(previousHref)}
      >
        <ChevronLeftIcon />
        Back
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!forwardHref}
        title={forwardTitle ?? (forwardHref ? 'Forward to next record' : 'No later record')}
        onClick={() => forwardHref && router.push(forwardHref)}
      >
        Forward
        <ChevronRightIcon />
      </Button>
    </>
  )
}

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
