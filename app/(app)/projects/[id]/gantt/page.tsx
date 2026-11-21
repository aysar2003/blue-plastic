import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as projectService from '@/server/services/project.service'
import * as projectTaskService from '@/server/services/project-task.service'

export const metadata: Metadata = { title: 'Project Gantt' }

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('project:read')
  const project = await projectService.get(ctx, id).catch(() => null)
  if (!project) notFound()
  const tasks = await projectTaskService.listForProject(ctx, project.id)

  const dated = tasks.filter((task) => task.startDate || task.deadline)
  const anchors = [
    ...dated.flatMap((task) => [task.startDate, task.deadline].filter(Boolean) as string[]),
    project.startDate,
    project.endDate,
  ].filter(Boolean) as string[]
  const min = anchors.length ? anchors.reduce((a, b) => (a < b ? a : b)) : null
  const max = anchors.length ? anchors.reduce((a, b) => (a > b ? a : b)) : null
  const spanMs = min && max && min !== max ? Date.parse(max) - Date.parse(min) : 0

  const byParent = new Map<string | null, typeof tasks>()
  for (const task of tasks) {
    const key = task.parentTaskId
    const list = byParent.get(key) ?? []
    list.push(task)
    byParent.set(key, list)
  }
  const ordered: { task: (typeof tasks)[number]; depth: number }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const task of byParent.get(parentId) ?? []) {
      ordered.push({ task, depth })
      walk(task.id, depth + 1)
    }
  }
  walk(null, 0)
  // Orphans whose parent is missing from the set
  const listed = new Set(ordered.map((row) => row.task.id))
  for (const task of tasks) {
    if (!listed.has(task.id)) ordered.push({ task, depth: 0 })
  }

  return (
    <>
      <PageHeader
        title={`Gantt · ${project.number}`}
        description={project.name}
        className="mb-4"
        actions={
          <Link href={`/projects/${project.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to project
          </Link>
        }
      />
      <Card className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Bars use task start → deadline when both are set; otherwise a marker on the deadline.
          {min && max ? ` Range ${formatDate(min)} → ${formatDate(max)}.` : ''}
        </p>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ul className="space-y-2">
            {ordered.map(({ task, depth }) => {
              const start = task.startDate ?? task.deadline
              const end = task.deadline ?? task.startDate
              let leftPct = 0
              let widthPct = 8
              if (min && max && spanMs > 0 && start) {
                leftPct = Math.max(
                  0,
                  Math.min(100, ((Date.parse(start) - Date.parse(min)) / spanMs) * 100),
                )
                if (end && end !== start) {
                  widthPct = Math.max(
                    4,
                    Math.min(100 - leftPct, ((Date.parse(end) - Date.parse(start)) / spanMs) * 100),
                  )
                }
              }
              const blockers = (task.blockersAsSuccessor ?? [])
                .map((d) => d.predecessor.name)
                .join(', ')
              return (
                <li
                  key={task.id}
                  className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center"
                  style={{ paddingLeft: `${depth * 12}px` }}
                >
                  <div className="truncate text-sm">
                    <span className="font-medium">{task.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {task.stage.replaceAll('_', ' ')}
                      {task.startDate ? ` · ${formatDate(task.startDate)}` : ''}
                      {task.deadline ? ` → ${formatDate(task.deadline)}` : ''}
                      {blockers ? ` · blocked by ${blockers}` : ''}
                    </span>
                  </div>
                  <div className="relative h-6 rounded bg-muted">
                    {start ? (
                      <div
                        className="absolute top-1 h-4 rounded bg-primary/70"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={task.name}
                      />
                    ) : (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-muted-foreground">
                        No dates
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
