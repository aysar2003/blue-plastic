'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  createProjectTaskForm,
  moveProjectTask,
} from '@/app/(app)/projects/actions'
import { idleState } from '@/components/forms/action-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const STAGES = PROJECT_TASK_STAGES.filter((stage) => stage !== 'CANCELLED')

export function ProjectTaskBoard({
  projectId,
  tasks,
  canEdit,
}: {
  projectId: string
  tasks: Task[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createProjectTaskForm, idleState)
  const [moving, startMove] = useTransition()

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

  return (
    <section className="mb-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tasks</h2>
          <p className="text-xs text-muted-foreground">
            Odoo-style board — move work from To do → In progress → Done.
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

      <div className="grid gap-3 md:grid-cols-3">
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
                    <p className="text-sm font-medium text-foreground">{task.name}</p>
                    {task.assignee ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{task.assignee.name}</p>
                    ) : null}
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
