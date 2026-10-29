import 'server-only'

import type { KnowledgeScope, Prisma } from '@prisma/client'

import { knowledgeTemplate } from '@/lib/knowledge-templates'
import type { KnowledgeInput, KnowledgeUpdateInput } from '@/lib/validation/knowledge'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'

const REVISION_CAP = 30

const SELECT = {
  id: true,
  title: true,
  body: true,
  scope: true,
  parentId: true,
  ownerId: true,
  sequence: true,
  icon: true,
  coverUrl: true,
  lockedAt: true,
  lockedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  lockedBy: { select: { id: true, name: true } },
  shares: { select: { userId: true, canEdit: true, user: { select: { id: true, name: true } } } },
} satisfies Prisma.KnowledgeArticleSelect

export type KnowledgeShareRow = {
  userId: string
  name: string
  canEdit: boolean
}

export type KnowledgeRow = {
  id: string
  title: string
  body: string
  scope: KnowledgeScope
  parentId: string | null
  ownerId: string | null
  sequence: number
  icon: string | null
  coverUrl: string | null
  lockedAt: Date | null
  lockedById: string | null
  lockedByName: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: string | null
  updatedById: string | null
  createdByName: string | null
  updatedByName: string | null
  favorite: boolean
  canEdit: boolean
  shares: KnowledgeShareRow[]
}

export type KnowledgeTreeNode = {
  id: string
  title: string
  scope: KnowledgeScope
  parentId: string | null
  icon: string | null
  favorite: boolean
  children: KnowledgeTreeNode[]
}

export type KnowledgeRevisionRow = {
  id: string
  title: string
  createdAt: Date
  createdByName: string | null
}

function mapRow(
  row: {
    id: string
    title: string
    body: string
    scope: KnowledgeScope
    parentId: string | null
    ownerId: string | null
    sequence: number
    icon: string | null
    coverUrl: string | null
    lockedAt: Date | null
    lockedById: string | null
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
    createdById: string | null
    updatedById: string | null
    createdBy: { id: string; name: string } | null
    updatedBy: { id: string; name: string } | null
    lockedBy: { id: string; name: string } | null
    shares: Array<{ userId: string; canEdit: boolean; user: { id: string; name: string } }>
  },
  ctx: OrgContext,
  favoriteIds: Set<string>,
): KnowledgeRow {
  const isOwner = row.ownerId === ctx.userId || row.createdById === ctx.userId
  const share = row.shares.find((item) => item.userId === ctx.userId)
  const canEdit =
    ctx.permissions.has('knowledge:update') &&
    !row.lockedAt &&
    (row.scope === 'WORKSPACE' ||
      isOwner ||
      Boolean(share?.canEdit) ||
      (row.scope === 'PRIVATE' && row.ownerId === ctx.userId))

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    scope: row.scope,
    parentId: row.parentId,
    ownerId: row.ownerId,
    sequence: row.sequence,
    icon: row.icon,
    coverUrl: row.coverUrl,
    lockedAt: row.lockedAt,
    lockedById: row.lockedById,
    lockedByName: row.lockedBy?.name ?? null,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdByName: row.createdBy?.name ?? null,
    updatedByName: row.updatedBy?.name ?? null,
    favorite: favoriteIds.has(row.id),
    canEdit,
    shares: row.shares.map((item) => ({
      userId: item.userId,
      name: item.user.name,
      canEdit: item.canEdit,
    })),
  }
}

async function sharedArticleIds(ctx: OrgContext) {
  const rows = await db.knowledgeShare.findMany({
    where: { orgId: ctx.orgId, userId: ctx.userId },
    select: { articleId: true },
  })
  return rows.map((row) => row.articleId)
}

/** Live (non-trash) articles this user may see. */
async function visibleWhere(ctx: OrgContext): Promise<Prisma.KnowledgeArticleWhereInput> {
  const sharedIds = await sharedArticleIds(ctx)
  return {
    orgId: ctx.orgId,
    deletedAt: null,
    OR: [
      { scope: 'WORKSPACE' },
      { scope: 'PRIVATE', ownerId: ctx.userId },
      { scope: 'SHARED', ownerId: ctx.userId },
      ...(sharedIds.length > 0 ? [{ id: { in: sharedIds } }] : []),
    ],
  }
}

async function favoriteIdsFor(ctx: OrgContext) {
  const rows = await db.knowledgeFavorite.findMany({
    where: { orgId: ctx.orgId, userId: ctx.userId },
    select: { articleId: true },
  })
  return new Set(rows.map((row) => row.articleId))
}

async function requireArticle(ctx: OrgContext, id: string, opts?: { includeDeleted?: boolean }) {
  const favorites = await favoriteIdsFor(ctx)
  const visibility = opts?.includeDeleted
    ? {
        orgId: ctx.orgId,
        OR: [
          { scope: 'WORKSPACE' as const },
          { scope: 'PRIVATE' as const, ownerId: ctx.userId },
          { scope: 'SHARED' as const, ownerId: ctx.userId },
          { shares: { some: { userId: ctx.userId } } },
        ],
      }
    : await visibleWhere(ctx)

  const row = await db.knowledgeArticle.findFirst({
    where: { id, ...visibility },
    select: SELECT,
  })
  if (!row) throw notFound('Article not found')
  return mapRow(row, ctx, favorites)
}

function assertCanManage(ctx: OrgContext, row: KnowledgeRow) {
  if (row.scope === 'PRIVATE' && row.ownerId !== ctx.userId) {
    throw forbidden('Only the owner can change a private article.')
  }
  if (row.scope === 'SHARED' && row.ownerId !== ctx.userId && !ctx.permissions.has('knowledge:delete')) {
    const share = row.shares.find((item) => item.userId === ctx.userId)
    if (!share?.canEdit) throw forbidden('You cannot manage this shared article.')
  }
}

function assertUnlocked(row: KnowledgeRow) {
  if (row.lockedAt) {
    throw validation('This article is locked. Unlock it to edit.', {
      id: ['Locked'],
    })
  }
}

function buildTree(
  rows: Array<{
    id: string
    title: string
    scope: KnowledgeScope
    parentId: string | null
    sequence: number
    icon: string | null
  }>,
  favoriteIds: Set<string>,
  scope: KnowledgeScope,
): KnowledgeTreeNode[] {
  const byParent = new Map<string | null, typeof rows>()
  for (const row of rows.filter((item) => item.scope === scope)) {
    const key = row.parentId
    const list = byParent.get(key) ?? []
    list.push(row)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sequence - b.sequence || a.title.localeCompare(b.title))
  }
  function walk(parentId: string | null): KnowledgeTreeNode[] {
    return (byParent.get(parentId) ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      scope: row.scope,
      parentId: row.parentId,
      icon: row.icon,
      favorite: favoriteIds.has(row.id),
      children: walk(row.id),
    }))
  }
  return walk(null)
}

async function pushRevision(ctx: OrgContext, article: { id: string; title: string; body: string }) {
  await db.knowledgeRevision.create({
    data: {
      orgId: ctx.orgId,
      articleId: article.id,
      title: article.title,
      body: article.body,
      createdById: ctx.userId,
    },
  })
  const extras = await db.knowledgeRevision.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: 'desc' },
    skip: REVISION_CAP,
    select: { id: true },
  })
  if (extras.length > 0) {
    await db.knowledgeRevision.deleteMany({ where: { id: { in: extras.map((row) => row.id) } } })
  }
}

async function cascadeScope(
  ctx: OrgContext,
  rootId: string,
  scope: KnowledgeScope,
  ownerId: string | null,
) {
  const queue = [rootId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const kids = await db.knowledgeArticle.findMany({
      where: { orgId: ctx.orgId, parentId, deletedAt: null },
      select: { id: true },
    })
    if (kids.length === 0) continue
    await db.knowledgeArticle.updateMany({
      where: { id: { in: kids.map((kid) => kid.id) } },
      data: { scope, ownerId, updatedById: ctx.userId },
    })
    queue.push(...kids.map((kid) => kid.id))
  }
}

export async function loadBoard(ctx: OrgContext, input?: { q?: string; trash?: boolean }) {
  const q = input?.q?.trim()
  const favorites = await favoriteIdsFor(ctx)
  const where = input?.trash
    ? {
        orgId: ctx.orgId,
        deletedAt: { not: null },
        OR: [
          { scope: 'WORKSPACE' as const },
          { scope: 'PRIVATE' as const, ownerId: ctx.userId },
          { scope: 'SHARED' as const, ownerId: ctx.userId },
          { shares: { some: { userId: ctx.userId } } },
        ],
      }
    : await visibleWhere(ctx)

  const rows = await db.knowledgeArticle.findMany({
    where: {
      ...where,
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { body: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: [{ sequence: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      scope: true,
      parentId: true,
      sequence: true,
      icon: true,
      deletedAt: true,
    },
  })

  const trashCount = await db.knowledgeArticle.count({
    where: {
      orgId: ctx.orgId,
      deletedAt: { not: null },
      OR: [
        { scope: 'WORKSPACE' },
        { scope: 'PRIVATE', ownerId: ctx.userId },
        { scope: 'SHARED', ownerId: ctx.userId },
        { shares: { some: { userId: ctx.userId } } },
      ],
    },
  })

  if (input?.trash) {
    return {
      workspace: [] as KnowledgeTreeNode[],
      shared: [] as KnowledgeTreeNode[],
      private: [] as KnowledgeTreeNode[],
      favorites: [] as KnowledgeTreeNode[],
      trash: rows.map((row) => ({
        id: row.id,
        title: row.title,
        scope: row.scope,
        parentId: row.parentId,
        icon: row.icon,
        favorite: false,
        children: [] as KnowledgeTreeNode[],
      })),
      trashCount,
      query: q ?? null,
    }
  }

  return {
    workspace: buildTree(rows, favorites, 'WORKSPACE'),
    shared: buildTree(rows, favorites, 'SHARED'),
    private: buildTree(rows, favorites, 'PRIVATE'),
    favorites: rows
      .filter((row) => favorites.has(row.id))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((row) => ({
        id: row.id,
        title: row.title,
        scope: row.scope,
        parentId: row.parentId,
        icon: row.icon,
        favorite: true,
        children: [] as KnowledgeTreeNode[],
      })),
    trash: [] as KnowledgeTreeNode[],
    trashCount,
    query: q ?? null,
  }
}

export async function get(ctx: OrgContext, id: string, opts?: { includeDeleted?: boolean }) {
  return requireArticle(ctx, id, opts)
}

export async function listRevisions(ctx: OrgContext, id: string) {
  await requireArticle(ctx, id)
  const rows = await db.knowledgeRevision.findMany({
    where: { orgId: ctx.orgId, articleId: id },
    orderBy: { createdAt: 'desc' },
    take: REVISION_CAP,
    select: {
      id: true,
      title: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })
  return rows.map(
    (row): KnowledgeRevisionRow => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      createdByName: row.createdBy?.name ?? null,
    }),
  )
}

export async function listMembers(ctx: OrgContext) {
  const rows = await db.membership.findMany({
    where: { orgId: ctx.orgId, status: 'ACTIVE', role: { not: 'CUSTOMER' } },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
    take: 200,
  })
  return rows
    .filter((row) => row.user.id !== ctx.userId)
    .map((row) => ({ id: row.user.id, name: row.user.name, email: row.user.email }))
}

export async function create(ctx: OrgContext, input: KnowledgeInput) {
  const template = input.templateKey ? knowledgeTemplate(input.templateKey) : null
  let scope: KnowledgeScope = input.scope ?? 'WORKSPACE'
  let parentId: string | null = input.parentId ?? null
  let ownerId: string | null = scope === 'WORKSPACE' ? null : ctx.userId
  let title = template?.title ?? input.title
  let body = template?.body ?? input.body
  let icon = input.icon ?? template?.icon ?? null

  if (parentId) {
    const parent = await requireArticle(ctx, parentId)
    scope = parent.scope
    ownerId = parent.scope === 'WORKSPACE' ? null : parent.ownerId ?? ctx.userId
  }

  const maxSeq = await db.knowledgeArticle.aggregate({
    where: { orgId: ctx.orgId, parentId, scope, deletedAt: null },
    _max: { sequence: true },
  })

  const row = await db.knowledgeArticle.create({
    data: {
      orgId: ctx.orgId,
      title,
      body,
      scope,
      parentId,
      ownerId,
      icon,
      sequence: (maxSeq._max.sequence ?? 0) + 1,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
    select: SELECT,
  })

  if (parentId) {
    const parentShares = await db.knowledgeShare.findMany({
      where: { articleId: parentId },
      select: { userId: true, canEdit: true },
    })
    if (parentShares.length > 0) {
      await db.knowledgeShare.createMany({
        data: parentShares.map((share) => ({
          orgId: ctx.orgId,
          articleId: row.id,
          userId: share.userId,
          canEdit: share.canEdit,
        })),
        skipDuplicates: true,
      })
    }
  }

  return mapRow(
    await db.knowledgeArticle.findFirstOrThrow({ where: { id: row.id }, select: SELECT }),
    ctx,
    await favoriteIdsFor(ctx),
  )
}

export async function createFromTemplate(
  ctx: OrgContext,
  input: { templateKey: string; scope?: KnowledgeScope; parentId?: string | null },
) {
  const template = knowledgeTemplate(input.templateKey)
  if (!template) throw validation('Unknown template.', { templateKey: ['Choose a template'] })
  return create(ctx, {
    title: template.title,
    body: template.body,
    scope: input.scope ?? 'WORKSPACE',
    parentId: input.parentId ?? null,
    icon: template.icon,
    templateKey: input.templateKey,
  })
}

export async function update(ctx: OrgContext, id: string, input: Pick<KnowledgeUpdateInput, 'title' | 'body'>) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  assertUnlocked(existing)
  if (!existing.canEdit && existing.scope === 'SHARED') {
    throw forbidden('You have read-only access to this article.')
  }

  await pushRevision(ctx, existing)

  const row = await db.knowledgeArticle.update({
    where: { id },
    data: {
      title: input.title,
      body: input.body,
      updatedById: ctx.userId,
    },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function setScope(ctx: OrgContext, id: string, scope: KnowledgeScope) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  if (existing.parentId) {
    throw validation('Move the parent article first, or detach this child.', {
      scope: ['Nested articles follow their parent'],
    })
  }
  const ownerId = scope === 'WORKSPACE' ? null : ctx.userId
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: { scope, ownerId, updatedById: ctx.userId },
    select: SELECT,
  })
  await cascadeScope(ctx, id, scope, ownerId)
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function setIcon(ctx: OrgContext, id: string, icon: string | null) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  assertUnlocked(existing)
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: { icon, updatedById: ctx.userId },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function setCoverUrl(ctx: OrgContext, id: string, coverUrl: string | null) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  assertUnlocked(existing)
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: { coverUrl, updatedById: ctx.userId },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function lock(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: { lockedAt: new Date(), lockedById: ctx.userId, updatedById: ctx.userId },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function unlock(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: { lockedAt: null, lockedById: null, updatedById: ctx.userId },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function duplicate(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id)
  const maxSeq = await db.knowledgeArticle.aggregate({
    where: { orgId: ctx.orgId, parentId: null, scope: 'PRIVATE', deletedAt: null },
    _max: { sequence: true },
  })
  const row = await db.knowledgeArticle.create({
    data: {
      orgId: ctx.orgId,
      title: `${existing.title} (copy)`,
      body: existing.body,
      scope: 'PRIVATE',
      parentId: null,
      ownerId: ctx.userId,
      icon: existing.icon,
      coverUrl: existing.coverUrl,
      sequence: (maxSeq._max.sequence ?? 0) + 1,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

export async function softDelete(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  const now = new Date()
  await db.knowledgeArticle.update({
    where: { id },
    data: { deletedAt: now, updatedById: ctx.userId },
  })
  // Cascade trash to descendants.
  const queue = [id]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const kids = await db.knowledgeArticle.findMany({
      where: { orgId: ctx.orgId, parentId, deletedAt: null },
      select: { id: true },
    })
    if (kids.length === 0) continue
    await db.knowledgeArticle.updateMany({
      where: { id: { in: kids.map((kid) => kid.id) } },
      data: { deletedAt: now, updatedById: ctx.userId },
    })
    queue.push(...kids.map((kid) => kid.id))
  }
}

export async function restore(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id, { includeDeleted: true })
  if (!existing.deletedAt) return existing
  assertCanManage(ctx, existing)
  await db.knowledgeArticle.update({
    where: { id },
    data: { deletedAt: null, updatedById: ctx.userId },
  })
  await db.knowledgeArticle.updateMany({
    where: { orgId: ctx.orgId, parentId: id, deletedAt: { not: null } },
    data: { deletedAt: null, updatedById: ctx.userId },
  })
  return requireArticle(ctx, id)
}

export async function purge(ctx: OrgContext, id: string) {
  const existing = await requireArticle(ctx, id, { includeDeleted: true })
  assertCanManage(ctx, existing)
  if (!ctx.permissions.has('knowledge:delete')) throw forbidden()
  await db.knowledgeArticle.delete({ where: { id } })
}

export async function share(
  ctx: OrgContext,
  id: string,
  input: { userId: string; canEdit: boolean },
) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  if (input.userId === ctx.userId) {
    throw validation('You already own this article.', { userId: ['Pick someone else'] })
  }
  const member = await db.membership.findFirst({
    where: { orgId: ctx.orgId, userId: input.userId, status: 'ACTIVE', role: { not: 'CUSTOMER' } },
    select: { userId: true },
  })
  if (!member) throw validation('That person is not on this company.', { userId: ['Choose a colleague'] })

  if (existing.scope !== 'SHARED') {
    await db.knowledgeArticle.update({
      where: { id },
      data: {
        scope: 'SHARED',
        ownerId: existing.ownerId ?? ctx.userId,
        updatedById: ctx.userId,
      },
    })
    await cascadeScope(ctx, id, 'SHARED', existing.ownerId ?? ctx.userId)
  }

  await db.knowledgeShare.upsert({
    where: { articleId_userId: { articleId: id, userId: input.userId } },
    create: {
      orgId: ctx.orgId,
      articleId: id,
      userId: input.userId,
      canEdit: input.canEdit,
    },
    update: { canEdit: input.canEdit },
  })
  return requireArticle(ctx, id)
}

export async function unshare(ctx: OrgContext, id: string, userId: string) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  await db.knowledgeShare.deleteMany({ where: { articleId: id, userId } })
  return requireArticle(ctx, id)
}

export async function toggleFavorite(ctx: OrgContext, id: string) {
  await requireArticle(ctx, id)
  const existing = await db.knowledgeFavorite.findUnique({
    where: { userId_articleId: { userId: ctx.userId, articleId: id } },
    select: { id: true },
  })
  if (existing) {
    await db.knowledgeFavorite.delete({ where: { id: existing.id } })
    return { id, favorite: false }
  }
  await db.knowledgeFavorite.create({
    data: { orgId: ctx.orgId, userId: ctx.userId, articleId: id },
  })
  return { id, favorite: true }
}

export async function restoreRevision(ctx: OrgContext, id: string, revisionId: string) {
  const existing = await requireArticle(ctx, id)
  assertCanManage(ctx, existing)
  assertUnlocked(existing)
  const revision = await db.knowledgeRevision.findFirst({
    where: { id: revisionId, articleId: id, orgId: ctx.orgId },
  })
  if (!revision) throw notFound('Revision not found')
  await pushRevision(ctx, existing)
  const row = await db.knowledgeArticle.update({
    where: { id },
    data: {
      title: revision.title,
      body: revision.body,
      updatedById: ctx.userId,
    },
    select: SELECT,
  })
  return mapRow(row, ctx, await favoriteIdsFor(ctx))
}

/** @deprecated hard delete — prefer softDelete */
export async function remove(ctx: OrgContext, id: string) {
  await softDelete(ctx, id)
}
