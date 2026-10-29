import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as knowledgeService from '@/server/services/knowledge.service'
import { KnowledgeShell } from './knowledge-shell'

export const metadata: Metadata = { title: 'Knowledge' }

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('knowledge:read')
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const trashMode = params.trash === '1' || params.trash === 'true'
  const board = await knowledgeService.loadBoard(ctx, { q, trash: trashMode })
  const members = await knowledgeService.listMembers(ctx)

  return (
    <>
      <PageHeader
        title={trashMode ? 'Knowledge trash' : 'Knowledge'}
        description={
          trashMode
            ? 'Restore pages or delete them forever.'
            : 'Company wiki — Workspace for everyone, Shared for invited people, Private for you. Star pages you use often.'
        }
        className="mb-0 border-b-0 pb-2"
      />
      <KnowledgeShell
        workspace={board.workspace}
        shared={board.shared}
        privateTree={board.private}
        favorites={board.favorites}
        trash={board.trash}
        trashCount={board.trashCount}
        trashMode={trashMode}
        article={null}
        revisions={[]}
        members={members}
        canCreate={ctx.permissions.has('knowledge:create')}
        canUpdate={ctx.permissions.has('knowledge:update')}
        canDelete={ctx.permissions.has('knowledge:delete')}
        timeZone={ctx.organization.timeZone}
        initialQuery={q}
      />
    </>
  )
}
