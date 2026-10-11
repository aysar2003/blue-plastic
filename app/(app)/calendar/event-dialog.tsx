'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  CALENDAR_KIND_LABELS,
  CALENDAR_KINDS,
  REMINDER_OPTIONS,
} from '@/lib/validation/calendar'
import { createEventForm, deleteEvent, updateEventForm } from './actions'

export type EventFormValues = {
  id?: string
  title: string
  description: string
  location: string
  kind: string
  date: string
  startTime: string
  endTime: string
  allDay: boolean
  reminderMinutes: number | null
  customerId: string | null
  vendorId: string | null
}

export function NewEventButton({
  defaultDate,
  canCreate,
}: {
  defaultDate: string
  canCreate: boolean
}) {
  const [open, setOpen] = useState(false)
  if (!canCreate) return null
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New event
      </Button>
      {open ? (
        <EventDialog
          initial={{
            title: '',
            description: '',
            location: '',
            kind: 'meeting',
            date: defaultDate,
            startTime: '09:00',
            endTime: '10:00',
            allDay: false,
            reminderMinutes: 15,
            customerId: null,
            vendorId: null,
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function EventDialog({
  initial,
  canDelete = false,
  onClose,
}: {
  initial: EventFormValues
  canDelete?: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const editing = Boolean(initial.id)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [date, setDate] = useState(initial.date)
  const [state, action] = useActionState(editing ? updateEventForm : createEventForm, idleState)
  const e = state.fieldErrors

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Saved.')
    onClose()
    router.refresh()
  }, [state, onClose, router])

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="md" className="max-h-[calc(100svh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'New event'}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={initial.id} /> : null}
          <Field name="title" label="Title" error={e?.title} required>
            <Input {...fieldProps('title', e?.title)} required defaultValue={initial.title} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="kind" label="Type" error={e?.kind}>
              <NativeSelect {...fieldProps('kind', e?.kind)} defaultValue={initial.kind}>
                {CALENDAR_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {CALENDAR_KIND_LABELS[kind]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field name="reminderMinutes" label="Reminder" error={e?.reminderMinutes}>
              <NativeSelect
                {...fieldProps('reminderMinutes', e?.reminderMinutes)}
                defaultValue={initial.reminderMinutes == null ? '' : String(initial.reminderMinutes)}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field name="date" label="Date" error={e?.date} required>
            <DateField
              id="date"
              name="date"
              value={date}
              onChange={setDate}
              today={initial.date}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            All day
          </label>
          {allDay ? (
            <>
              <input type="hidden" name="startTime" value="09:00" />
              <input type="hidden" name="endTime" value="17:00" />
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="startTime" label="Starts" error={e?.startTime}>
                <Input
                  {...fieldProps('startTime', e?.startTime)}
                  type="time"
                  required
                  defaultValue={initial.startTime}
                />
              </Field>
              <Field name="endTime" label="Ends" error={e?.endTime}>
                <Input
                  {...fieldProps('endTime', e?.endTime)}
                  type="time"
                  required
                  defaultValue={initial.endTime}
                />
              </Field>
            </div>
          )}
          <Field name="location" label="Location" error={e?.location}>
            <Input
              {...fieldProps('location', e?.location)}
              defaultValue={initial.location}
              placeholder="Office, Zoom, customer site…"
            />
          </Field>
          <Field name="description" label="Notes" error={e?.description}>
            <textarea
              {...fieldProps('description', e?.description)}
              defaultValue={initial.description}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </Field>
          <FormStatus state={state} />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {editing && canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!initial.id || !window.confirm('Delete this event?')) return
                  const result = await deleteEvent({ id: initial.id })
                  if (result.ok) {
                    toast.success('Event deleted.')
                    onClose()
                    router.refresh()
                  } else {
                    toast.error(result.error.message)
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton>{editing ? 'Save' : 'Add to calendar'}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
