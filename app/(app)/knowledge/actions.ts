'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  knowledgeCoverSchema,
  knowledgeCreateSchema,
  knowledgeIconSchema,
  knowledgeIdSchema,
  knowledgeMoveSchema,
  knowledgeRestoreRevisionSchema,
  knowledgeShareSchema,
  knowledgeTemplateSchema,
  knowledgeUnshareSchema,
  knowledgeUpdateSchema,
} from '@/lib/validation/knowledge'
import { action } from '@/server/action'
import * as knowledgeService from '@/server/services/knowledge.service'

function revalidateKnowledge(id?: string) {
  revalidatePath('/knowledge')
  revalidatePath('/dashboard')
  if (id) revalidatePath(`/knowledge/${id}`)
}

export const createArticle = action
  .requires('knowledge:create')
  .input(knowledgeCreateSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.create(ctx, input)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

export const createFromTemplate = action
  .requires('knowledge:create')
  .input(knowledgeTemplateSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.createFromTemplate(ctx, input)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

export const updateArticle = action
  .requires('knowledge:update')
  .input(knowledgeUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await knowledgeService.update(ctx, id, rest)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

export const moveArticle = action
  .requires('knowledge:update')
  .input(knowledgeMoveSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.setScope(ctx, input.id, input.scope)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title, scope: row.scope }
  })

export const setArticleIcon = action
  .requires('knowledge:update')
  .input(knowledgeIconSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.setIcon(ctx, input.id, input.icon ?? null)
    revalidateKnowledge(row.id)
    return { id: row.id, icon: row.icon }
  })

export const setArticleCover = action
  .requires('knowledge:update')
  .input(knowledgeCoverSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.setCoverUrl(ctx, input.id, input.coverUrl)
    revalidateKnowledge(row.id)
    return { id: row.id, coverUrl: row.coverUrl }
  })

export const lockArticle = action
  .requires('knowledge:update')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.lock(ctx, input.id)
    revalidateKnowledge(row.id)
    return { id: row.id }
  })

export const unlockArticle = action
  .requires('knowledge:update')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.unlock(ctx, input.id)
    revalidateKnowledge(row.id)
    return { id: row.id }
  })

export const duplicateArticle = action
  .requires('knowledge:create')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.duplicate(ctx, input.id)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

export const trashArticle = action
  .requires('knowledge:delete')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    await knowledgeService.softDelete(ctx, input.id)
    revalidateKnowledge()
    return { id: input.id }
  })

export const restoreArticle = action
  .requires('knowledge:update')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.restore(ctx, input.id)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

export const purgeArticle = action
  .requires('knowledge:delete')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    await knowledgeService.purge(ctx, input.id)
    revalidateKnowledge()
    return { id: input.id }
  })

export const shareArticle = action
  .requires('knowledge:update')
  .input(knowledgeShareSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.share(ctx, input.id, {
      userId: input.userId,
      canEdit: input.canEdit,
    })
    revalidateKnowledge(row.id)
    return { id: row.id, shares: row.shares }
  })

export const unshareArticle = action
  .requires('knowledge:update')
  .input(knowledgeUnshareSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.unshare(ctx, input.id, input.userId)
    revalidateKnowledge(row.id)
    return { id: row.id, shares: row.shares }
  })

export const toggleFavorite = action
  .requires('knowledge:read')
  .input(knowledgeIdSchema)
  .handler(async (ctx, input) => {
    const result = await knowledgeService.toggleFavorite(ctx, input.id)
    revalidateKnowledge(input.id)
    return result
  })

export const restoreRevision = action
  .requires('knowledge:update')
  .input(knowledgeRestoreRevisionSchema)
  .handler(async (ctx, input) => {
    const row = await knowledgeService.restoreRevision(ctx, input.id, input.revisionId)
    revalidateKnowledge(row.id)
    return { id: row.id, name: row.title }
  })

/** Soft-delete alias kept for older UI calls. */
export const deleteArticle = trashArticle

export async function createArticleForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await createArticle(formValues(formData)), 'Article saved.')
}

export async function updateArticleForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateArticle(formValues(formData)), 'Article updated.')
}

export async function quickCreateArticle(
  scope: 'WORKSPACE' | 'SHARED' | 'PRIVATE',
  parentId?: string | null,
) {
  return createArticle({
    title: 'Untitled',
    body: '<p></p>',
    scope,
    parentId: parentId ?? null,
  })
}
