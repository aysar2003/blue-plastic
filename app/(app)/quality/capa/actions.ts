'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as capaService from '@/server/services/capa.service'

const PATH = '/quality/capa'

export async function createCapa(formData: FormData) {
  const ctx = await requireOrgContext('docs:create')
  const note = await capaService.create(ctx, {
    number: String(formData.get('number') ?? '') || undefined,
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? '') || undefined,
    ownerId: String(formData.get('ownerId') || '') || null,
    dueDate: String(formData.get('dueDate') || '') || null,
    rootCause: String(formData.get('rootCause') || '') || null,
    vendorId: String(formData.get('vendorId') || '') || null,
    lotNumber: String(formData.get('lotNumber') || '') || null,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/${note.id}`)
}

export async function updateCapaAction(formData: FormData) {
  const ctx = await requireOrgContext('docs:update')
  const id = String(formData.get('id') ?? '')
  await capaService.update(ctx, id, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? '') || null,
    ownerId: String(formData.get('ownerId') || '') || null,
    dueDate: String(formData.get('dueDate') || '') || null,
    rootCause: String(formData.get('rootCause') || '') || null,
    effectivenessDate: String(formData.get('effectivenessDate') || '') || null,
    vendorId: String(formData.get('vendorId') || '') || null,
    lotNumber: String(formData.get('lotNumber') || '') || null,
  })
  revalidatePath(PATH)
  redirect(`${PATH}/${id}`)
}

export async function setCapaStatusAction(formData: FormData) {
  const ctx = await requireOrgContext('docs:update')
  const status = String(formData.get('status') ?? '')
  const closeNote = String(formData.get('closeNote') ?? '') || undefined
  const effectivenessDate = String(formData.get('effectivenessDate') ?? '') || undefined
  await capaService.setStatus(ctx, String(formData.get('id') ?? ''), status, {
    closeNote,
    effectivenessDate,
  })
  revalidatePath(PATH)
  const returnTo = String(formData.get('returnTo') ?? '').trim()
  redirect(returnTo || PATH)
}