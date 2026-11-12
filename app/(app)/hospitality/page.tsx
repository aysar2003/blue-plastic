import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as hotel from '@/server/services/hotel.service'

export const metadata: Metadata = { title: 'Hospitality' }

export default async function HospitalityHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  const occ = await hotel.occupancy(ctx)
  const stays = await hotel.listOpenStays(ctx)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Hotel / guesthouse"
        description="Rooms, stays, and folio billing into sales invoices. Not a full PMS."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Occupancy</CardTitle>
          <CardDescription>
            {occ.occupied}/{occ.rooms} rooms occupied · {occ.percent}%
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/hospitality/rooms" className="underline underline-offset-4">
            Rooms & housekeeping
          </Link>
          <Link href="/hospitality/stays" className="underline underline-offset-4">
            Open stays ({stays.length})
          </Link>
          <Link href="/customers" className="underline underline-offset-4">
            Guests (customers)
          </Link>
          <Link href="/pos" className="underline underline-offset-4">
            POS / F&B
          </Link>
          <Link href="/pos/night-audit" className="underline underline-offset-4">
            Night audit
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurant tools</CardTitle>
          <CardDescription>
            Shared POS kitchen, tables, and night audit for hotel F&B or standalone restaurant packs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/pos/tables" className="underline underline-offset-4">
            Dining tables
          </Link>
          <Link href="/pos/kitchen" className="underline underline-offset-4">
            Kitchen tickets
          </Link>
          <Link href="/pos/sessions" className="underline underline-offset-4">
            Till sessions
          </Link>
          <Link href="/reports/packs" className="underline underline-offset-4">
            Report packs
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
