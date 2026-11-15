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
  })
  revalidatePath(PATH)
  redirect(`${PATH}/${note.id}`)
}

export async function setCapaStatusAction(formData: FormData) {
  const ctx = await requireOrgContext('docs:update')
  const status = String(formData.get('status') ?? '')
  const closeNote = String(formData.get('closeNote') ?? '') || undefined
  await capaService.setStatus(ctx, String(formData.get('id') ?? ''), status, { closeNote })
  revalidatePath(PATH)
  const returnTo = String(formData.get('returnTo') ?? '').trim()
  redirect(returnTo || PATH)
}