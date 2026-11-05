import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { knownPackReportKeys } from '@/lib/report-packs'
import { requireOrgContext } from '@/server/auth/context'

import { PackForm } from '../pack-form'

export const metadata: Metadata = { title: 'New report pack' }

export default async function NewReportPackPage() {
  const ctx = await requireOrgContext('report:export')
  if (!ctx.permissions.has('report:export')) redirect('/reports/packs')

  return (
    <>
      <PageHeader title="New report pack" description="Pick the reports to bundle and how often to run them." />
      <PackForm reportKeys={knownPackReportKeys()} />
    </>
  )
}
