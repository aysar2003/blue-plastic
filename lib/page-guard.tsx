import type { ReactNode } from 'react'

import { DatabaseUnavailable } from '@/components/system/database-unavailable'
import { isDatabaseUnavailable, isNavigationError } from '@/lib/db-error'

/** Redirects and not-found keep working. A database failure becomes a page. */
export function unavailablePage(error: unknown) {
  if (isNavigationError(error)) throw error
  if (!isDatabaseUnavailable(error)) return null
  return <DatabaseUnavailable error={error} />
}

/** Run a page's data load. A database failure renders in place of an opaque 500. */
export async function withDatabasePage<T>(load: () => Promise<T>): Promise<T | ReactNode> {
  try {
    return await load()
  } catch (error) {
    const page = unavailablePage(error)
    if (page) return page
    throw error
  }
}
