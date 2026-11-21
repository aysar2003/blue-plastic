import { redirect } from 'next/navigation'

import { COMPANY_SNAPSHOT_HREF } from '@/lib/business-overview-access'

/** Legacy shortcut — Snapshot lives under Reports. */
export default async function SnapshotsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') params.set(key, value)
    else if (Array.isArray(value) && value[0]) params.set(key, value[0])
  }
  const qs = params.toString()
  redirect(qs ? `${COMPANY_SNAPSHOT_HREF}?${qs}` : COMPANY_SNAPSHOT_HREF)
}
