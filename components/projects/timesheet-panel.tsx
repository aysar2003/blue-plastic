'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  createTimeEntry,
  deleteTimeEntry,
} from '@/app/(app)/projects/[id]/timesheets/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Entry = {
  id: string
  workDate: string
  hours: string
  description: string | null
  billable: boolean
  billableRate: string | null
  invoicedAt: Date | null
  task: { id: string; name: string } | null
  user: { id: string; name: string }
}

export function TimesheetPanel({
  projectId,
  today,
  currency,
  canEdit,
  tasks,
  entries,
}: {
  projectId: string
  today: string
  currency: string
  canEdit: boolean
  tasks: { id: string; name: string }[]
  entries: Entry[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [workDate, setWorkDate] = useState(today)
  const [hours, setHours] = useState('1')
  const [description, setDescription] = useState('')
  const [billableRate, setBillableRate] = useState('')
  const [taskId, setTaskId] = useState('')
  const [billable, setBillable] = useState(true)

  return (
    <section className="mt-8 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Timesheets</h2>
        <p className="text-xs text-muted-foreground">
          Log hours on this job. Billable rows can be pulled onto an invoice (same idea as billable
          expenses).
        </p>
      </div>

      {canEdit ? (
        <form
          className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault()
            start(async () => {
              const result = await createTimeEntry({
                projectId,
                taskId: taskId || null,
                workDate,
                hours,
                description: description || null,
                billable,
                billableRate: billableRate || null,
              })
              if (!result.ok) {
                toast.error(result.error.message)
                return
              }
              toast.success('Time logged.')
              setHours('1')
              setDescription('')
              router.refresh()
            })
          }}
        >
          <label className="text-xs">
            Date
            <Input
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              className="mt-1"
              required
            />
          </label>
          <label className="text-xs">
            Hours
            <Input
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className="mt-1 tabular"
              required
            />
          </label>
          <label className="text-xs lg:col-span-2">
            Description
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-xs">
            Rate ({currency}/h)
            <Input
              value={billableRate}
              onChange={(event) => setBillableRate(event.target.value)}
              className="mt-1 tabular"
              disabled={!billable}
            />
          </label>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={billable}
                onChange={(event) => setBillable(event.target.checked)}
              />
              Billable
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Add hours'}
            </Button>
          </div>
          {tasks.length > 0 ? (
            <label className="text-xs sm:col-span-2 lg:col-span-6">
              Task (optional)
              <select
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— none —</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </form>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time logged yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <span className="font-medium tabular">{entry.hours}h</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {entry.workDate} · {entry.user.name}
                  {entry.task ? ` · ${entry.task.name}` : ''}
                </span>
                {entry.description ? (
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {entry.billable
                    ? entry.invoicedAt
                      ? 'Invoiced'
                      : `Billable${entry.billableRate ? ` @ ${entry.billableRate}` : ''}`
                    : 'Non-billable'}
                </p>
              </div>
              {canEdit && !entry.invoicedAt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await deleteTimeEntry({ id: entry.id, projectId })
                      if (!result.ok) {
                        toast.error(result.error.message)
                        return
                      }
                      toast.success('Removed.')
                      router.refresh()
                    })
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
