import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as hospital from '@/server/services/hospital.service'

export const metadata: Metadata = { title: 'Hospital billing' }

export default async function HospitalHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  const stats = await hospital.hubStats(ctx)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Hospital billing"
        description="Patient visits, service charges, and AR invoices. This is not a clinical EMR or chart."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {stats.open} open visits · {stats.closed} closed (invoiced)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/hospital/visits" className="underline underline-offset-4">
            Visits & charges
          </Link>
          <Link href="/hospital/claims" className="underline underline-offset-4">
            Claims export
          </Link>
          <Link href="/customers" className="underline underline-offset-4">
            Patients (customers)
          </Link>
          <Link href="/items" className="underline underline-offset-4">
            Service items
          </Link>
          <Link href="/settings/classes" className="underline underline-offset-4">
            Departments (classes)
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
