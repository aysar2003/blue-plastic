import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as docs from '@/server/files/workspace-documents'
import { DocumentsBoard } from './documents-board'

export const metadata: Metadata = { title: 'Documents' }

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('docs:read')
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const [folders, rows, unfiledCount] = await Promise.all([
    docs.listFolders(ctx),
    docs.listDocuments(ctx, { q }),
    docs.countUnfiled(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Documents"
        description="Company workspace — folders, contracts, scans, and papers."
        className="mb-0 border-b-0 pb-2"
      />
      <DocumentsBoard
        folders={folders}
        unfiledCount={unfiledCount}
        rows={rows.map((row) => ({
          id: row.id,
          folderId: row.folderId,
          title: row.title,
          originalName: row.originalName,
          contentType: row.contentType,
          byteSize: row.byteSize,
          notes: row.notes,
          createdAt: row.createdAt.toISOString(),
          createdByName: row.createdByName,
        }))}
        canCreate={ctx.permissions.has('docs:create')}
        canUpdate={ctx.permissions.has('docs:update')}
        canDelete={ctx.permissions.has('docs:delete')}
        timeZone={ctx.organization.timeZone}
      />
    </>
  )
}
