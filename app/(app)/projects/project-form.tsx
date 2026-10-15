'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Card } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatusValue,
} from '@/lib/validation/project'
import { createProjectForm, updateProjectForm } from './actions'

export type ProjectFormCustomer = { id: string; label: string }

export type ProjectFormValues = {
  id?: string
  number: string
  name: string
  customerId: string
  siteLocation: string
  description: string
  status: ProjectStatusValue
  startDate: string
  endDate: string
}

export function ProjectForm({
  customers,
  initial,
  documentNumber,
}: {
  customers: ProjectFormCustomer[]
  initial: ProjectFormValues
  documentNumber: string
}) {
  const router = useRouter()
  const editing = Boolean(initial.id)
  const [customerId, setCustomerId] = useState(initial.customerId)
  const [status, setStatus] = useState(initial.status)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [state, action] = useActionState(editing ? updateProjectForm : createProjectForm, idleState)
  const e = state.fieldErrors

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Saved.')
    if (editing) router.refresh()
  }, [state, editing, router])

  return (
    <Card className="mx-auto max-w-2xl p-4 sm:p-6">
      <form action={action} className="space-y-4">
        {editing ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="startDate" value={startDate} />
        <input type="hidden" name="endDate" value={endDate} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="number" label="Number" error={e?.number}>
            <Input
              {...fieldProps('number', e?.number)}
              defaultValue={initial.number || documentNumber}
              placeholder={documentNumber}
            />
          </Field>
          <Field name="status" label="Status" error={e?.status}>
            <NativeSelect
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatusValue)}
            >
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PROJECT_STATUS_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field name="name" label="Project name" required error={e?.name}>
          <Input
            {...fieldProps('name', e?.name)}
            defaultValue={initial.name}
            placeholder="e.g. Villa renovation — Phase 1"
            required
          />
        </Field>

        <Field name="customerId" label="Customer" required error={e?.customerId}>
          <EntityPicker
            kind="customer"
            options={customers}
            value={customerId || null}
            onChange={(id) => setCustomerId(id ?? '')}
            placeholder="Choose customer"
            error={e?.customerId}
          />
        </Field>

        <Field name="siteLocation" label="Site / location" error={e?.siteLocation}>
          <Input
            {...fieldProps('siteLocation', e?.siteLocation)}
            defaultValue={initial.siteLocation}
            placeholder="Delivery address or site name"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="startDate" label="Start date" error={e?.startDate}>
            <DateField value={startDate} onChange={setStartDate} />
          </Field>
          <Field name="endDate" label="End date" error={e?.endDate}>
            <DateField value={endDate} onChange={setEndDate} />
          </Field>
        </div>

        <Field name="description" label="Description" error={e?.description}>
          <textarea
            {...fieldProps('description', e?.description)}
            defaultValue={initial.description}
            rows={3}
            placeholder="Scope notes for the job"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </Field>

        <FormStatus state={state} />
        <div className="flex justify-end">
          <SubmitButton>{editing ? 'Save changes' : 'Create project'}</SubmitButton>
        </div>
      </form>
    </Card>
  )
}
