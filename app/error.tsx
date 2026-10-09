'use client'

import { AlertTriangleIcon } from 'lucide-react'

import { AccessDenied } from '@/components/system/access-denied'
import { Button } from '@/components/ui/button'
import { isForbiddenError } from '@/lib/access-denied'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  if (isForbiddenError(error)) return <AccessDenied standalone />

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <AlertTriangleIcon className="size-8 text-red-600" />
      <h1 className="text-2xl font-semibold tracking-tight">This page could not be loaded</h1>
      <p className="text-sm leading-relaxed text-neutral-600">
        Nothing was saved. If this started after a deploy, check that DATABASE_URL, DIRECT_URL, and AUTH_SECRET are
        set for Production, and that migrations have been applied with pnpm db:deploy.
      </p>
      {error.digest ? (
        <p className="text-xs text-neutral-500">
          Reference <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <div>
        <Button type="button" variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  )
}
