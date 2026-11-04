'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export async function assignPlanning(formData: FormData) {
  const ctx = await requireOrgContext('project:create')
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const workDate = String(formData.get('workDate') ?? '').trim()
  const hours = String(formData.get('hours') ?? '').trim()
  const taskId = String(formData.get('taskId') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  await collab.assignPlanning(ctx, { employeeId, workDate, hours, taskId, notes })
  revalidatePath('/planning')
  redirect('/planning')
}
