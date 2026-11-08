import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'NGO / nonprofit' }

export default async function NgoHubPage() {
  await requireOrgContext('customer:read')

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="NGO / nonprofit"
        description="Donor pledges, fund tags (classes), and grant budget vs actual. Not a full fund-restriction engine."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tools</CardTitle>
          <CardDescription>Funds are tracking classes; pledges become customer payments when received.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Link href="/ngo/pledges" className="underline underline-offset-4">
            Donor pledges
          </Link>
          <Link href="/ngo/grants" className="underline underline-offset-4">
            Grant budget vs actual
          </Link>
          <Link href="/settings/classes" className="underline underline-offset-4">
            Funds / programmes
          </Link>
          <Link href="/customers" className="underline underline-offset-4">
            Donors (customers)
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
