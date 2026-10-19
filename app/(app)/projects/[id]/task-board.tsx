'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import {
  createProjectTaskForm,
  deleteProjectTask,
  moveProjectTask,
  updateProjectTaskForm,
} from '@/app/(app)/projects/actions'
import { idleState } from '@/components/forms/action-state'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate } from '@/lib/date'
import {
  PROJECT_TASK_STAGE_LABELS,
  PROJECT_TASK_STAGES,
  type ProjectTaskInput,
} from '@/lib/validation/project-task'
import { cn } from '@/lib/utils'

type Task = {
  id: string
  name: string
  description: string | null
  stage: (typeof PROJECT_TASK_STAGES)[number]
  deadline: string | null
  assignee: { id: string; name: string } | null
}

type Member = { id: string; name: string }

const STAGES = PROJECT_TASK_STAGES

export function ProjectTaskBoard({
  projectId,
  tasks,
  members,
  canEdit,
}: {
  projectId: string
  tasks: Task[]
  members: Member[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createProjectTaskForm, idleState)
  const [moving, startMove] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [state, router])

  function move(id: string, stage: ProjectTaskInput['stage']) {
    startMove(async () => {
      const result = await moveProjectTask({ id, stage })
      if (result.ok) {
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`Delete task “${name}”?`)) return
    startMove(async () => {
      const result = await deleteProjectTask({ id })
      if (result.ok) {
        toast.success('Task deleted.')
        setEditingId(null)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const done = tasks.filter((task) => task.stage === 'DONE').length
  const open = tasks.filter((task) => task.stage !== 'DONE' && task.stage !== 'CANCELLED').length

  return (
    <section className="mb-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tasks</h2>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? 'Add work, assign someone, and move it To do → In progress → Done.'
              : `${done} done · ${open} open · ${tasks.length} total`}
          </p>
        </div>
        {canEdit ? (
          <form action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stage" value="TODO" />
            <Input
              name="name"
              required
              placeholder="New task"
              className="h-8 w-48"
              aria-label="Task name"
            />
            <Button type="submit" size="sm" disabled={pending}>
              <PlusIcon /> Add
            </Button>
            {state.status === 'error' && state.message ? (
              <span className="text-xs text-destructive">{state.message}</span>
            ) : null}
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const column = tasks.filter((task) => task.stage === stage)
          return (
            <div
              key={stage}
              className="min-h-[12rem] rounded-xl border border-border bg-muted/30 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {PROJECT_TASK_STAGE_LABELS[stage]}
                </p>
                <span className="text-[10px] tabular text-muted-foreground">{column.length}</span>
              </div>
              <ul className="space-y-2">
                {column.map((task) => (
                  <li
                    key={task.id}
                    className={cn(
                      'rounded-lg border border-border bg-card p-2.5 shadow-sm',
                      moving && 'opacity-70',
                    )}
                  >
                    {editingId === task.id && canEdit ? (
                      <TaskEditor
                        task={task}
                        members={members}
                        onClose={() => setEditingId(null)}
                        onDeleted={() => remove(task.id, task.name)}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{task.name}</p>
                          {canEdit ? (
                            <button
                              type="button"
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Edit ${task.name}`}
                              onClick={() => setEditingId(task.id)}
                            >
                              <PencilIcon className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                        {task.description ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            {task.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {task.assignee?.name ?? 'Unassigned'}
                          {task.deadline ? ` · ${formatDate(task.deadline)}` : ''}
                        </p>
                        {canEdit ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {STAGES.filter((next) => next !== stage).map((next) => (
                              <button
                                key={next}
                                type="button"
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                                onClick={() => move(task.id, next)}
                              >
                                → {PROJECT_TASK_STAGE_LABELS[next]}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
                {column.length === 0 ? (
                  <li className="px-1 py-6 text-center text-xs text-muted-foreground">Empty</li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TaskEditor({
  task,
  members,
  onClose,
  onDeleted,
}: {
  task: Task
  members: Member[]
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateProjectTaskForm, idleState)
  const [deadline, setDeadline] = useState(task.deadline ?? '')
  const [stage, setStage] = useState(task.stage)
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '')

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Task saved.')
    onClose()
    router.refresh()
  }, [state, onClose, router])

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="deadline" value={deadline} />
      <input type="hidden" name="stage" value={stage} />
      <input type="hidden" name="assigneeId" value={assigneeId} />
      <Field name="name" label="Task" error={state.fieldErrors?.name}>
        <Input name="name" required defaultValue={task.name} className="h-8" />
      </Field>
      <Field name="description" label="Notes" error={state.fieldErrors?.description}>
        <textarea
          name="description"
          defaultValue={task.description ?? ''}
          rows={2}
          className="flex min-h-[48px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Field>
      <div className="grid gap-2">
        <Field name="assigneeId" label="Assignee">
          <NativeSelect
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="h-8"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field name="deadline" label="Deadline">
          <DateField value={deadline} onChange={setDeadline} />
        </Field>
        <Field name="stage" label="Stage">
          <NativeSelect
            value={stage}
            onChange={(event) => setStage(event.target.value as Task['stage'])}
            className="h-8"
          >
            {PROJECT_TASK_STAGES.map((value) => (
              <option key={value} value={value}>
                {PROJECT_TASK_STAGE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {state.status === 'error' && state.message ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDeleted}>
          <Trash2Icon />
          Delete
        </Button>
      </div>
    </form>
  )
}
