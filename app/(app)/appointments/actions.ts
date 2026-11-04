'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export async function bookAppointment(formData: FormData) {
  const ctx = await requireOrgContext('calendar:create')
  const typeId = String(formData.get('typeId') ?? '').trim()
  const startsAt = String(formData.get('startsAt') ?? '').trim()
  const endsAt = String(formData.get('endsAt') ?? '').trim()
  const guestName = String(formData.get('guestName') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  await collab.bookAppointment(ctx, {
    typeId,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    guestName,
    notes,
  })
  revalidatePath('/appointments')
  revalidatePath('/calendar')
  redirect('/appointments')
}

export async function setAppointmentStatus(formData: FormData) {
  const ctx = await requireOrgContext('calendar:create')
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '') as 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  await collab.setAppointmentStatus(ctx, { id, status })
  revalidatePath('/appointments')
  revalidatePath('/calendar')
  redirect('/appointments')
}

export async function createAppointmentType(formData: FormData) {
  const ctx = await requireOrgContext('calendar:create')
  const name = String(formData.get('name') ?? '').trim()
  const durationMins = Number(formData.get('durationMins') ?? 30)
  await collab.createAppointmentType(ctx, { name, durationMins })
  revalidatePath('/appointments')
  revalidatePath('/calendar')
  redirect('/appointments')
}
