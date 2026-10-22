import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { PROJECT_REPORT_APPS } from '@/components/layout/project-apps'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Project reports' }

export default async function ProjectReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Projects"
      title="Project reports"
      subtitle="Jobs, and whether they made money."
      apps={PROJECT_REPORT_APPS}
      searchable
    />
  )
}
