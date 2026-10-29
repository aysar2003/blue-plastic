import { z } from 'zod'

import { KNOWLEDGE_TEMPLATES } from '@/lib/knowledge-templates'
import { cuid, optionalText, requiredText } from '@/lib/validation/common'

export const KNOWLEDGE_SCOPES = ['WORKSPACE', 'SHARED', 'PRIVATE'] as const
export type KnowledgeScopeValue = (typeof KNOWLEDGE_SCOPES)[number]

const optionalParent = z
  .union([cuid, z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const templateKeys = KNOWLEDGE_TEMPLATES.map((row) => row.key) as [string, ...string[]]

export const knowledgeInputSchema = z.object({
  title: requiredText('Title', 200),
  body: z.string().max(200_000, 'Body must be 200,000 characters or fewer'),
  scope: z.enum(KNOWLEDGE_SCOPES).optional().default('WORKSPACE'),
  parentId: optionalParent,
  icon: optionalText(8),
  templateKey: z.enum(templateKeys).optional().nullable(),
})

export const knowledgeCreateSchema = knowledgeInputSchema

export const knowledgeUpdateSchema = z.object({
  id: cuid,
  title: requiredText('Title', 200),
  body: z.string().max(200_000, 'Body must be 200,000 characters or fewer'),
})

export const knowledgeIdSchema = z.object({ id: cuid })

export const knowledgeMoveSchema = z.object({
  id: cuid,
  scope: z.enum(KNOWLEDGE_SCOPES),
})

export const knowledgeIconSchema = z.object({
  id: cuid,
  icon: optionalText(8),
})

export const knowledgeCoverSchema = z.object({
  id: cuid,
  coverUrl: z
    .union([z.string().trim().url('Enter a valid image URL'), z.literal('')])
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
})

export const knowledgeShareSchema = z.object({
  id: cuid,
  userId: cuid,
  canEdit: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
    .transform((value) => value === true || value === 'true' || value === 'on'),
})

export const knowledgeUnshareSchema = z.object({
  id: cuid,
  userId: cuid,
})

export const knowledgeRestoreRevisionSchema = z.object({
  id: cuid,
  revisionId: cuid,
})

export const knowledgeTemplateSchema = z.object({
  templateKey: z.enum(templateKeys),
  scope: z.enum(KNOWLEDGE_SCOPES).optional().default('WORKSPACE'),
  parentId: optionalParent,
})

export type KnowledgeInput = z.infer<typeof knowledgeInputSchema>
export type KnowledgeUpdateInput = z.infer<typeof knowledgeUpdateSchema>
