import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as projectTaskService from '@/server/services/project-task.service'

export const metadata: Metadata = { title: 'My tasks' }

export default async function MyProjectTasksPage() {
  const ctx = await requireOrgContext('project:read')
  const tasks = await projectTaskService.listMine(ctx)

  return (
    <>
      <PageHeader
        title="My tasks"
        description="Open project tasks assigned to you."
        className="mb-4"
      />
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing assigned right now.</p>
      ) : (
        <Card className="divide-y">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${task.project.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">{task.name}</p>
                <p className="text-xs text-muted-foreground">
                  {task.project.number} · {task.project.name}
                  {task.deadline ? ` · due ${formatDate(task.deadline)}` : ''}
                </p>
              </div>
              <Badge variant="outline">{task.stage.replaceAll('_', ' ')}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </>
  )
}
