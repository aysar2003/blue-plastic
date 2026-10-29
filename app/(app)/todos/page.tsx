import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { today } from '@/lib/date'
import { TODO_STAGES } from '@/lib/todo-workflow'
import { requireOrgContext } from '@/server/auth/context'
import * as todoService from '@/server/services/todo.service'
import { TodoBoard } from './todo-board'

export const metadata: Metadata = { title: 'To-do' }

export default async function TodosPage() {
  const ctx = await requireOrgContext('todo:read')
  const [byStage, members] = await Promise.all([
    todoService.listForUser(ctx),
    todoService.listColleagues(ctx),
  ])

  const serialize = (row: (typeof byStage.OPEN)[number]) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate,
    priority: row.priority,
    stage: row.stage,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    completionKind: row.completionKind,
    completionNote: row.completionNote,
    completedByName: row.completedByName,
    ownerName: row.ownerName,
    ownerId: row.userId,
    assigneeName: row.assigneeName,
    assigneeId: row.assigneeId,
  })

  const stages = Object.fromEntries(
    TODO_STAGES.map((stage) => [stage, byStage[stage].map(serialize)]),
  ) as Record<(typeof TODO_STAGES)[number], ReturnType<typeof serialize>[]>

  return (
    <>
      <PageHeader
        title="To-do"
        description="Four stages — Open, In progress, Waiting, Done. When finishing, leave a note or submit a complaint / report. Email or WhatsApp when you assign."
      />
      <TodoBoard
        stages={stages}
        members={members}
        currentUserId={ctx.userId}
        canCreate={ctx.permissions.has('todo:create')}
        canUpdate={ctx.permissions.has('todo:update')}
        canDelete={ctx.permissions.has('todo:delete')}
        today={today(ctx.organization.timeZone)}
      />
    </>
  )
}
