'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as kitchen from '@/server/services/kitchen.service'

const PATH = '/pos/kitchen'

export async function openTicket(formData: FormData) {
  const ctx = await requireOrgContext('pos:sell')
  await kitchen.openTicket(ctx, {
    tableLabel: String(formData.get('tableLabel') ?? ''),
    covers: String(formData.get('covers') ?? '1'),
    lines: String(formData.get('lines') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function bumpTicket(formData: FormData) {
  const ctx = await requireOrgContext('pos:sell')
  await kitchen.bumpTicket(ctx, String(formData.get('id') ?? ''))
  revalidatePath(PATH)
  redirect(PATH)
}
