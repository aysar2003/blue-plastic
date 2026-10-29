import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as knowledgeService from '@/server/services/knowledge.service'
import { KnowledgeShell } from '../knowledge-shell'

export const metadata: Metadata = { title: 'Article' }

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('knowledge:read')
  const { id } = await params

  let article
  try {
    article = await knowledgeService.get(ctx, id)
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') {
      try {
        article = await knowledgeService.get(ctx, id, { includeDeleted: true })
      } catch {
        notFound()
      }
    } else {
      throw error
    }
  }

  const trashMode = Boolean(article.deletedAt)
  const [board, revisions, members] = await Promise.all([
    knowledgeService.loadBoard(ctx, { trash: trashMode }),
    trashMode ? Promise.resolve([]) : knowledgeService.listRevisions(ctx, id),
    knowledgeService.listMembers(ctx),
  ])

  return (
    <>
      <PageHeader
        title={article.title || 'Untitled'}
        description="Knowledge article"
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
        article={{
          id: article.id,
          title: article.title,
          body: article.body,
          scope: article.scope,
          parentId: article.parentId,
          icon: article.icon,
          coverUrl: article.coverUrl,
          lockedAt: article.lockedAt ? article.lockedAt.toISOString() : null,
          lockedByName: article.lockedByName,
          deletedAt: article.deletedAt ? article.deletedAt.toISOString() : null,
          favorite: article.favorite,
          canEdit: article.canEdit,
          shares: article.shares,
          updatedAt: article.updatedAt.toISOString(),
          createdByName: article.createdByName,
          updatedByName: article.updatedByName,
        }}
        revisions={revisions.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.createdAt.toISOString(),
          createdByName: row.createdByName,
        }))}
        members={members}
        canCreate={ctx.permissions.has('knowledge:create')}
        canUpdate={ctx.permissions.has('knowledge:update')}
        canDelete={ctx.permissions.has('knowledge:delete')}
        timeZone={ctx.organization.timeZone}
      />
    </>
  )
}
