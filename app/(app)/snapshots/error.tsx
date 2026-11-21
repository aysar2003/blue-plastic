'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

export default function SnapshotsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[snapshots]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto max-w-lg rounded-md border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <h1 className="text-lg font-semibold">Company Snapshot could not load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page hit an unexpected error. Your books were not changed. Close and reopen Snapshot, or
        try again.
      </p>
      <Button type="button" className="mt-4" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
