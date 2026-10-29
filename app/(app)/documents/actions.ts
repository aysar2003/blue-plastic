'use server'

import { revalidatePath } from 'next/cache'

import { toFormState, type FormState } from '@/components/forms/action-state'
import {
  workspaceDocumentCompleteUploadSchema,
  workspaceDocumentFolderCreateSchema,
  workspaceDocumentFolderIdSchema,
  workspaceDocumentFolderUpdateSchema,
  workspaceDocumentIdSchema,
  workspaceDocumentMoveSchema,
  workspaceDocumentPrepareUploadSchema,
  workspaceDocumentUpdateSchema,
} from '@/lib/validation/workspace-document'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as docs from '@/server/files/workspace-documents'

function revalidateDocuments() {
  revalidatePath('/documents')
  revalidatePath('/dashboard')
}

function optionalFolderId(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return value
}

export async function uploadDocumentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireOrgContext('docs:create')
    const fileEntry = formData.get('file')
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
    if (!file) {
      return {
        status: 'error',
        message: 'Choose a PDF or image to upload.',
        fieldErrors: { file: ['Choose a file'] },
      }
    }
    const row = await docs.uploadDocument(ctx, file, {
      title: String(formData.get('title') ?? ''),
      notes: String(formData.get('notes') ?? '') || null,
      folderId: optionalFolderId(String(formData.get('folderId') ?? '') || null),
    })
    revalidateDocuments()
    return { status: 'success', message: 'Uploaded.', created: { id: row.id, label: row.title } }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, code: error.code, fieldErrors: error.details }
    }
    console.error('[documents/upload]', error)
    return { status: 'error', message: 'Could not upload the file.' }
  }
}

export const prepareDocumentUpload = action
  .requires('docs:create')
  .input(workspaceDocumentPrepareUploadSchema)
  .handler(async (ctx, input) => docs.prepareDocumentUpload(ctx, input))

export const completeDocumentUpload = action
  .requires('docs:create')
  .input(workspaceDocumentCompleteUploadSchema)
  .handler(async (ctx, input) => {
    const row = await docs.completeDocumentUpload(ctx, {
      ...input,
      folderId: optionalFolderId(input.folderId),
    })
    revalidateDocuments()
    return { id: row.id, name: row.title }
  })

export const updateDocument = action
  .requires('docs:update')
  .input(workspaceDocumentUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, folderId, ...rest } = input
    const row = await docs.updateDocument(ctx, id, {
      ...rest,
      ...(folderId !== undefined ? { folderId: optionalFolderId(folderId) } : {}),
    })
    revalidateDocuments()
    return { id: row.id, name: row.title }
  })

export const moveDocument = action
  .requires('docs:update')
  .input(workspaceDocumentMoveSchema)
  .handler(async (ctx, input) => {
    const row = await docs.moveDocument(ctx, input.id, input.folderId)
    revalidateDocuments()
    return { id: row.id, name: row.title }
  })

export const deleteDocument = action
  .requires('docs:delete')
  .input(workspaceDocumentIdSchema)
  .handler(async (ctx, input) => {
    await docs.removeDocument(ctx, input.id)
    revalidateDocuments()
    return { id: input.id }
  })

export const createFolder = action
  .requires('docs:create')
  .input(workspaceDocumentFolderCreateSchema)
  .handler(async (ctx, input) => {
    const row = await docs.createFolder(ctx, input.name)
    revalidateDocuments()
    return { id: row.id, name: row.name }
  })

export const renameFolder = action
  .requires('docs:update')
  .input(workspaceDocumentFolderUpdateSchema)
  .handler(async (ctx, input) => {
    const row = await docs.renameFolder(ctx, input.id, input.name)
    revalidateDocuments()
    return { id: row.id, name: row.name }
  })

export const deleteFolder = action
  .requires('docs:delete')
  .input(workspaceDocumentFolderIdSchema)
  .handler(async (ctx, input) => {
    await docs.removeFolder(ctx, input.id)
    revalidateDocuments()
    return { id: input.id }
  })

export async function updateDocumentForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(
    await updateDocument({
      id: String(formData.get('id') ?? ''),
      title: String(formData.get('title') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      folderId: String(formData.get('folderId') ?? '') || null,
    }),
    'Document saved.',
  )
}
