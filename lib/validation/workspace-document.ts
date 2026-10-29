import { z } from 'zod'

import { cuid, optionalText, requiredText } from '@/lib/validation/common'

export const workspaceDocumentUpdateSchema = z.object({
  id: cuid,
  title: requiredText('Title', 200),
  notes: optionalText(4000),
  folderId: z.union([cuid, z.literal(''), z.null()]).optional(),
})

export const workspaceDocumentIdSchema = z.object({ id: cuid })

export const workspaceDocumentMoveSchema = z.object({
  id: cuid,
  folderId: z.union([cuid, z.null()]),
})

export const workspaceDocumentFolderCreateSchema = z.object({
  name: requiredText('Folder name', 80),
})

export const workspaceDocumentFolderUpdateSchema = z.object({
  id: cuid,
  name: requiredText('Folder name', 80),
})

export const workspaceDocumentFolderIdSchema = z.object({ id: cuid })

export const workspaceDocumentPrepareUploadSchema = z.object({
  fileName: requiredText('File name', 180),
  contentType: requiredText('Content type', 120),
  byteSize: z.number().int().positive().max(100 * 1024 * 1024),
})

export const workspaceDocumentCompleteUploadSchema = z.object({
  storageKey: requiredText('Storage key', 220),
  fileName: requiredText('File name', 180),
  contentType: requiredText('Content type', 120),
  byteSize: z.number().int().positive().max(100 * 1024 * 1024),
  title: optionalText(200),
  notes: optionalText(4000),
  folderId: z.union([cuid, z.literal(''), z.null()]).optional(),
})

export type WorkspaceDocumentUpdateInput = z.infer<typeof workspaceDocumentUpdateSchema>
