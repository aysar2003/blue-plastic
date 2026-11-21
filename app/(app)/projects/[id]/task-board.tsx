'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import {
  addProjectTaskDependency,
  createProjectTaskForm,
  deleteProjectTask,
  moveProjectTask,
  removeProjectTaskDependency,
  updateProjectTaskForm,
} from '@/app/(app)/projects/actions'
import { idleState } from '@/components/forms/action-state'
import { Field } from '@/components/forms/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate } from '@/lib/date'
import {
  PROJECT_TASK_STAGE_LABELS,
  PROJECT_TASK_STAGES,
  type ProjectBoardStage,
} from '@/lib/validation/project-task'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Task = {
  id: string
  name: string
  description: string | null
  stage: string
  deadline: string | null
  startDate: string | null
  parentTaskId: string | null
  assignee: { id: string; name: string } | null
  blockersAsSuccessor?: {
    id: string
    predecessorId: string
    predecessor: { id: string; name: string; stage: string }
  }[]
}

type Member = { id: string; name: string }

function defaultStages(): ProjectBoardStage[] {
  return PROJECT_TASK_STAGES.map((key) => ({
    key,
    label: PROJECT_TASK_STAGE_LABELS[key],
  }))
}

function resolveStages(boardStages: unknown): ProjectBoardStage[] {
  if (!Array.isArray(boardStages) || boardStages.length === 0) return defaultStages()
  const parsed: ProjectBoardStage[] = []
  for (const row of boardStages) {
    if (
      row &&
      typeof row === 'object' &&
      typeof (row as { key?: unknown }).key === 'string' &&
      typeof (row as { label?: unknown }).label === 'string'
    ) {
      parsed.push({
        key: (row as { key: string }).key,
        label: (row as { label: string }).label,
      })
    }
  }
  return parsed.length > 0 ? parsed : defaultStages()
}

export function ProjectTaskBoard({
  projectId,
  tasks,
  members,
  canEdit,
  boardStages,
}: {
  projectId: string
  tasks: Task[]
  members: Member[]
  canEdit: boolean
  boardStages?: unknown
}) {
  const router = useRouter()
  const stages = resolveStages(boardStages)
  const stageKeys = stages.map((s) => s.key)
  const [state, action, pending] = useActionState(createProjectTaskForm, idleState)
  const [moving, startMove] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [state, router])

  function move(id: string, stage: string) {
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
  // Tasks whose stage is not in the board still show under a catch-all.
  const known = new Set(stageKeys)
  const orphanStages = [...new Set(tasks.map((t) => t.stage).filter((s) => !known.has(s)))].map(
    (key) => ({ key, label: key.replaceAll('_', ' ') }),
  )
  const columns = [...stages, ...orphanStages]

  return (
    <section className="mb-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tasks</h2>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? 'Add work, assign someone, and move it across the board.'
              : `${done} done · ${open} open · ${tasks.length} total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${projectId}/gantt`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Gantt
          </Link>
          {canEdit ? (
            <form action={action} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="stage" value={stageKeys[0] ?? 'TODO'} />
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
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(columns.length, 6)}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((col) => {
          const column = tasks.filter((task) => task.stage === col.key)
          return (
            <div
              key={col.key}
              className="min-h-[12rem] rounded-xl border border-border bg-muted/30 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </p>
                <span className="text-[10px] tabular text-muted-foreground">{column.length}</span>
              </div>
              <ul className="space-y-2">
                {column.map((task) => {
                  const blockers = (task.blockersAsSuccessor ?? []).filter(
                    (d) =>
                      d.predecessor.stage !== 'DONE' && d.predecessor.stage !== 'CANCELLED',
                  )
                  return (
                    <li
                      key={task.id}
                      className={cn(
                        'rounded-lg border border-border bg-card p-2.5 shadow-sm',
                        moving && 'opacity-70',
                        task.parentTaskId && 'ml-2 border-l-2 border-l-primary/40',
                      )}
                    >
                      {editingId === task.id && canEdit ? (
                        <TaskEditor
                          task={task}
                          tasks={tasks}
                          members={members}
                          stages={columns}
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
                            {task.startDate ? ` · start ${formatDate(task.startDate)}` : ''}
                            {task.deadline ? ` · due ${formatDate(task.deadline)}` : ''}
                          </p>
                          {blockers.length > 0 ? (
                            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                              Blocked by {blockers.map((b) => b.predecessor.name).join(', ')}
                            </p>
                          ) : null}
                          {canEdit ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {columns
                                .filter((next) => next.key !== col.key)
                                .map((next) => (
                                  <button
                                    key={next.key}
                                    type="button"
                                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                                    onClick={() => move(task.id, next.key)}
                                  >
                                    → {next.label}
                                  </button>
                                ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </li>
                  )
                })}
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
  tasks,
  members,
  stages,
  onClose,
  onDeleted,
}: {
  task: Task
  tasks: Task[]
  members: Member[]
  stages: ProjectBoardStage[]
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateProjectTaskForm, idleState)
  const [deadline, setDeadline] = useState(task.deadline ?? '')
  const [startDate, setStartDate] = useState(task.startDate ?? '')
  const [stage, setStage] = useState(task.stage)
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '')
  const [parentTaskId, setParentTaskId] = useState(task.parentTaskId ?? '')
  const [blockerId, setBlockerId] = useState('')
  const [busy, startBusy] = useTransition()

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Task saved.')
    onClose()
    router.refresh()
  }, [state, onClose, router])

  function addBlocker() {
    if (!blockerId) return
    startBusy(async () => {
      const result = await addProjectTaskDependency({
        predecessorId: blockerId,
        successorId: task.id,
      })
      if (result.ok) {
        toast.success('Blocker added.')
        setBlockerId('')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  function removeBlocker(id: string) {
    startBusy(async () => {
      const result = await removeProjectTaskDependency({ id })
      if (result.ok) {
        toast.success('Blocker removed.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="deadline" value={deadline} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="stage" value={stage} />
      <input type="hidden" name="assigneeId" value={assigneeId} />
      <input type="hidden" name="parentTaskId" value={parentTaskId} />
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
        <Field name="parentTaskId" label="Parent task">
          <NativeSelect
            value={parentTaskId}
            onChange={(event) => setParentTaskId(event.target.value)}
            className="h-8"
          >
            <option value="">None</option>
            {tasks
              .filter((row) => row.id !== task.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field name="startDate" label="Start">
          <DateField value={startDate} onChange={setStartDate} />
        </Field>
        <Field name="deadline" label="Deadline">
          <DateField value={deadline} onChange={setDeadline} />
        </Field>
        <Field name="stage" label="Stage">
          <NativeSelect
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="h-8"
          >
            {stages.map((value) => (
              <option key={value.key} value={value.key}>
                {value.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground">Blocked by</p>
        <ul className="space-y-1">
          {(task.blockersAsSuccessor ?? []).map((dep) => (
            <li key={dep.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span>{dep.predecessor.name}</span>
              <button
                type="button"
                className="text-destructive hover:underline"
                disabled={busy}
                onClick={() => removeBlocker(dep.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <NativeSelect
            value={blockerId}
            onChange={(event) => setBlockerId(event.target.value)}
            className="h-8 flex-1"
          >
            <option value="">Add blocker…</option>
            {tasks
              .filter(
                (row) =>
                  row.id !== task.id &&
                  !(task.blockersAsSuccessor ?? []).some((d) => d.predecessorId === row.id),
              )
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </NativeSelect>
          <Button type="button" size="sm" variant="outline" disabled={busy || !blockerId} onClick={addBlocker}>
            Add
          </Button>
        </div>
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
