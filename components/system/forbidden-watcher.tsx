'use client'

import { useEffect } from 'react'

import { installForbiddenFetchNotice } from '@/lib/forbidden-notice'

/** Warns when a server action or API call comes back forbidden. */
export function ForbiddenWatcher() {
  useEffect(() => installForbiddenFetchNotice(), [])
  return null
}
