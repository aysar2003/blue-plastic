'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldOffIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { accessDeniedCopy, sectionLabel } from '@/lib/access-denied'
import { cn } from '@/lib/utils'

/**
 * Signed-in people who open a section they cannot use land here.
 * The Somali line is the message; English sits under it.
 */
export function AccessDenied({
  section,
  standalone = false,
}: {
  /** Pass a name when the path is not enough. Omit to read it from the URL. */
  section?: string | null
  /** Full viewport, for routes that sit outside the app shell. */
  standalone?: boolean
}) {
  const pathname = usePathname()
  const name = section !== undefined ? section : sectionLabel(pathname || '/')
  const copy = accessDeniedCopy(name)

  return (
    <div
      data-access-denied
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center',
        standalone ? 'mx-auto min-h-svh max-w-lg' : 'rounded-md border border-dashed',
      )}
    >
      <ShieldOffIcon className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 lang="so" className="text-base font-medium text-balance">
          {copy.title}
        </h1>
        <p lang="en" className="text-sm text-muted-foreground text-balance">
          {copy.subtitle}
        </p>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        <span lang="so" className="block">
          {copy.hintSo}
        </span>
        <span lang="en" className="mt-1 block">
          {copy.hintEn}
        </span>
      </p>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  )
}
