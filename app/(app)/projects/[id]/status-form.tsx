'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { NativeSelect } from '@/components/ui/native-select'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatusValue,
} from '@/lib/validation/project'
import { setProjectStatusForm } from '../actions'

export function ProjectStatusForm({
  id,
  status,
}: {
  id: string
  status: ProjectStatusValue
}) {
  const router = useRouter()
  const [state, action] = useActionState(setProjectStatusForm, idleState)

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Status updated.')
    router.refresh()
  }, [state, router])

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <NativeSelect
        name="status"
        defaultValue={status}
        className="h-8 w-auto"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {PROJECT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {PROJECT_STATUS_LABELS[value]}
          </option>
        ))}
      </NativeSelect>
    </form>
  )
}
