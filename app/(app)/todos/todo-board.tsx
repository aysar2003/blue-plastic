'use client'

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGridIcon, ListIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import {
  completeTodo,
  createTodoForm,
  deleteTodo,
  reopenTodo,
  setTodoStage,
} from '@/app/(app)/todos/actions'
import { idleState } from '@/components/forms/action-state'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate, isBefore, type CalendarDate } from '@/lib/date'
import { TODO_PRIORITY_LABELS, type TodoPriority } from '@/lib/todo-notify'
import {
  TODO_COMPLETION_LABELS,
  TODO_COMPLETIONS,
  TODO_STAGE_LABELS,
  TODO_STAGES,
  type TodoCompletion,
  type TodoStage,
} from '@/lib/todo-workflow'
import { cn } from '@/lib/utils'

type Todo = {
  id: string
  title: string
  notes: string | null
  dueDate: string | null
  priority: TodoPriority
  stage: TodoStage
  doneAt: string | null
  completionKind: TodoCompletion | null
  completionNote: string | null
  completedByName: string | null
  ownerName: string
  ownerId: string
  assigneeName: string | null
  assigneeId: string | null
}

type Member = { id: string; name: string; phone: string | null }
type ViewMode = 'board' | 'table'

export function TodoBoard({
  stages,
  members,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
  today,
}: {
  stages: Record<TodoStage, Todo[]>
  members: Member[]
  currentUserId: string
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  today: CalendarDate
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createTodoForm, idleState)
  const [busy, startBusy] = useTransition()
  const [showNotes, setShowNotes] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<string>('0')
  const [assigneeId, setAssigneeId] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [view, setView] = useState<ViewMode>('board')
  const [completing, setCompleting] = useState<Todo | null>(null)
  const [completionKind, setCompletionKind] = useState<TodoCompletion>('COMPLETED')
  const [completionNote, setCompletionNote] = useState('')

  const assigningOther = Boolean(assigneeId && assigneeId !== currentUserId)
  const selectedMember = members.find((member) => member.id === assigneeId)
  const allTodos = useMemo(() => TODO_STAGES.flatMap((stage) => stages[stage]), [stages])
  const openCount = stages.OPEN.length + stages.IN_PROGRESS.length + stages.WAITING.length
  const overdueCount = useMemo(
    () =>
      allTodos.filter(
        (todo) => todo.stage !== 'DONE' && isOverdue(todo.dueDate, today),
      ).length,
    [allTodos, today],
  )

  useEffect(() => {
    if (state.status !== 'success') return
    setShowNotes(false)
    setDueDate('')
    setPriority('0')
    setAssigneeId('')
    setNotifyEmail(true)
    setNotifyWhatsapp(false)
    setWhatsappPhone('')
    if (state.whatsappUrl) {
      window.open(state.whatsappUrl, '_blank', 'noopener,noreferrer')
      toast.success(state.message ?? 'Added. WhatsApp opened.')
    } else if (state.warning) {
      toast.warning(state.warning)
    } else if (state.message) {
      toast.success(state.message)
    }
    router.refresh()
  }, [state, router])

  function moveStage(id: string, stage: TodoStage) {
    if (stage === 'DONE') {
      const todo = allTodos.find((row) => row.id === id)
      if (todo) {
        setCompleting(todo)
        setCompletionKind('COMPLETED')
        setCompletionNote('')
      }
      return
    }
    startBusy(async () => {
      const result = await setTodoStage({ id, stage })
      if (result.ok) router.refresh()
      else toast.error(result.error.message)
    })
  }

  function submitComplete() {
    if (!completing) return
    startBusy(async () => {
      const result = await completeTodo({
        id: completing.id,
        completionKind,
        completionNote: completionNote.trim() || undefined,
      })
      if (result.ok) {
        toast.success('Marked done.')
        setCompleting(null)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  function reopen(id: string) {
    startBusy(async () => {
      const result = await reopenTodo({ id })
      if (result.ok) router.refresh()
      else toast.error(result.error.message)
    })
  }

  function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”?`)) return
    startBusy(async () => {
      const result = await deleteTodo({ id })
      if (result.ok) {
        toast.success('Deleted.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-[clamp(0.75rem,2vw,2.5rem)] pb-16">
      {canCreate ? (
        <form action={action} className="space-y-3 rounded-lg border border-border/80 bg-card p-4">
          <Field name="title" label="New to-do" error={state.fieldErrors?.title}>
            <Input
              id="title"
              name="title"
              placeholder="What needs doing?"
              required
              maxLength={200}
              autoComplete="off"
              disabled={pending}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field name="dueDate" label="Deadline" error={state.fieldErrors?.dueDate}>
              <DateField
                id="dueDate"
                name="dueDate"
                value={dueDate}
                onChange={setDueDate}
                today={today}
                disabled={pending}
              />
            </Field>
            <Field name="priority" label="Priority" error={state.fieldErrors?.priority}>
              <NativeSelect
                id="priority"
                name="priority"
                disabled={pending}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="0">{TODO_PRIORITY_LABELS[0]}</option>
                <option value="1">{TODO_PRIORITY_LABELS[1]}</option>
                <option value="2">{TODO_PRIORITY_LABELS[2]}</option>
              </NativeSelect>
            </Field>
            <Field name="assigneeId" label="Assign to" error={state.fieldErrors?.assigneeId}>
              <NativeSelect
                id="assigneeId"
                name="assigneeId"
                disabled={pending}
                value={assigneeId}
                onChange={(event) => {
                  const next = event.target.value
                  setAssigneeId(next)
                  if (next && next !== currentUserId) {
                    setNotifyEmail(true)
                    const member = members.find((row) => row.id === next)
                    setWhatsappPhone(member?.phone ?? '')
                  } else {
                    setNotifyWhatsapp(false)
                    setWhatsappPhone('')
                  }
                }}
              >
                <option value="">Me (unassigned)</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {assigningOther ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium text-foreground">Notify assignee</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="notifyEmail"
                  value="true"
                  checked={notifyEmail}
                  onChange={(event) => setNotifyEmail(event.target.checked)}
                  disabled={pending}
                  className="size-4 accent-[var(--primary)]"
                />
                Email assignee
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="notifyWhatsapp"
                  value="true"
                  checked={notifyWhatsapp}
                  onChange={(event) => {
                    const on = event.target.checked
                    setNotifyWhatsapp(on)
                    if (on && !whatsappPhone && selectedMember?.phone) {
                      setWhatsappPhone(selectedMember.phone)
                    }
                  }}
                  disabled={pending}
                  className="size-4 accent-[var(--primary)]"
                />
                WhatsApp assignee
              </label>
              {notifyWhatsapp ? (
                <Field
                  name="whatsappPhone"
                  label="WhatsApp number"
                  error={state.fieldErrors?.whatsappPhone}
                >
                  <Input
                    id="whatsappPhone"
                    name="whatsappPhone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="25261… (country code, no +)"
                    value={whatsappPhone}
                    onChange={(event) => setWhatsappPhone(event.target.value)}
                    disabled={pending}
                    maxLength={40}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
          {showNotes ? (
            <Field name="notes" label="Notes" error={state.fieldErrors?.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                disabled={pending}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowNotes(true)}
            >
              Add notes
            </button>
          )}
          {state.status === 'error' && state.message ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Work board</h2>
          <p className="text-xs text-muted-foreground">
            {allTodos.length === 0
              ? 'Nothing on the list yet.'
              : `${openCount} open · ${stages.DONE.length} done${
                  overdueCount > 0 ? ` · ${overdueCount} overdue` : ''
                }`}
          </p>
        </div>
        <div
          className="inline-flex rounded-md border border-border bg-card p-0.5"
          role="group"
          aria-label="View mode"
        >
          <ViewToggle
            active={view === 'board'}
            label="Board"
            icon={<LayoutGridIcon className="size-3.5" />}
            onClick={() => setView('board')}
          />
          <ViewToggle
            active={view === 'table'}
            label="Table"
            icon={<ListIcon className="size-3.5" />}
            onClick={() => setView('table')}
          />
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TODO_STAGES.map((stage) => (
            <BoardColumn
              key={stage}
              stage={stage}
              items={stages[stage]}
              currentUserId={currentUserId}
              today={today}
              busy={busy}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onMove={moveStage}
              onReopen={reopen}
              onDelete={remove}
            />
          ))}
        </div>
      ) : (
        <TodoTable
          rows={allTodos}
          currentUserId={currentUserId}
          today={today}
          busy={busy}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onMove={moveStage}
          onReopen={reopen}
          onDelete={remove}
        />
      )}

      <Dialog open={Boolean(completing)} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Finish to-do</DialogTitle>
            <DialogDescription>
              {completing
                ? `How did “${completing.title}” go? Leave a note or file a complaint / report.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field name="completionKind" label="Result">
              <NativeSelect
                value={completionKind}
                onChange={(event) => setCompletionKind(event.target.value as TodoCompletion)}
                disabled={busy}
              >
                {TODO_COMPLETIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TODO_COMPLETION_LABELS[kind]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field name="completionNote" label="Note / report">
              <textarea
                rows={4}
                maxLength={4000}
                value={completionNote}
                onChange={(event) => setCompletionNote(event.target.value)}
                disabled={busy}
                placeholder={
                  completionKind === 'REPORT' || completionKind === 'BLOCKED'
                    ? 'Required — what happened?'
                    : 'Optional note for the manager'
                }
                className="border-input bg-background flex min-h-[88px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={submitComplete}>
              {busy ? 'Saving…' : 'Mark done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ViewToggle({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function BoardColumn({
  stage,
  items,
  currentUserId,
  today,
  busy,
  canUpdate,
  canDelete,
  onMove,
  onReopen,
  onDelete,
}: {
  stage: TodoStage
  items: Todo[]
  currentUserId: string
  today: CalendarDate
  busy: boolean
  canUpdate: boolean
  canDelete: boolean
  onMove: (id: string, stage: TodoStage) => void
  onReopen: (id: string) => void
  onDelete: (id: string, title: string) => void
}) {
  return (
    <section className="min-h-[12rem] rounded-xl border border-border bg-muted/30 p-2">
      <header className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {TODO_STAGE_LABELS[stage]}
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="px-1 py-8 text-center text-xs text-muted-foreground">Empty</li>
        ) : (
          items.map((todo) => (
            <li
              key={todo.id}
              className={cn(
                'rounded-lg border border-border bg-card p-2.5 shadow-sm',
                busy && 'opacity-70',
              )}
            >
              <TodoCardBody
                todo={todo}
                currentUserId={currentUserId}
                today={today}
                busy={busy}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onMove={onMove}
                onReopen={() => onReopen(todo.id)}
                onDelete={() => onDelete(todo.id, todo.title)}
              />
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

function TodoTable({
  rows,
  currentUserId,
  today,
  busy,
  canUpdate,
  canDelete,
  onMove,
  onReopen,
  onDelete,
}: {
  rows: Todo[]
  currentUserId: string
  today: CalendarDate
  busy: boolean
  canUpdate: boolean
  canDelete: boolean
  onMove: (id: string, stage: TodoStage) => void
  onReopen: (id: string) => void
  onDelete: (id: string, title: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
      <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="border-b border-border/70 px-3 py-2.5">Task</th>
            <th className="w-28 border-b border-border/70 px-3 py-2.5">Stage</th>
            <th className="w-28 border-b border-border/70 px-3 py-2.5">Result</th>
            <th className="w-36 border-b border-border/70 px-3 py-2.5">Deadline</th>
            <th className="w-40 border-b border-border/70 px-3 py-2.5">From / Assigned</th>
            <th className="w-44 border-b border-border/70 px-3 py-2.5">Move</th>
            <th className="w-12 border-b border-border/70 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nothing on the list yet.
              </td>
            </tr>
          ) : (
            rows.map((todo) => {
              const overdue = todo.stage !== 'DONE' && isOverdue(todo.dueDate, today)
              return (
                <tr key={todo.id} className={cn(busy && 'opacity-70')}>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top">
                    <p
                      className={cn(
                        'font-medium',
                        todo.stage === 'DONE' && 'text-muted-foreground line-through',
                      )}
                    >
                      {todo.title}
                    </p>
                    {todo.notes ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{todo.notes}</p>
                    ) : null}
                    {todo.completionNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Close note: {todo.completionNote}
                      </p>
                    ) : null}
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top">
                    <StageBadge stage={todo.stage} overdue={overdue} />
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top">
                    {todo.completionKind ? (
                      <span className="text-xs text-muted-foreground">
                        {TODO_COMPLETION_LABELS[todo.completionKind]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top">
                    <DeadlineLabel
                      dueDate={todo.dueDate}
                      overdue={overdue}
                      done={todo.stage === 'DONE'}
                    />
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top text-muted-foreground">
                    <PeopleLabel todo={todo} currentUserId={currentUserId} />
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 align-top">
                    {canUpdate ? (
                      <StageMoves
                        todo={todo}
                        busy={busy}
                        onMove={onMove}
                        onReopen={() => onReopen(todo.id)}
                      />
                    ) : null}
                  </td>
                  <td className="border-b border-border/50 px-2 py-2 align-top">
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={`Delete ${todo.title}`}
                        onClick={() => onDelete(todo.id, todo.title)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function TodoCardBody({
  todo,
  currentUserId,
  today,
  busy,
  canUpdate,
  canDelete,
  onMove,
  onReopen,
  onDelete,
}: {
  todo: Todo
  currentUserId: string
  today: CalendarDate
  busy: boolean
  canUpdate: boolean
  canDelete: boolean
  onMove: (id: string, stage: TodoStage) => void
  onReopen: () => void
  onDelete: () => void
}) {
  const overdue = todo.stage !== 'DONE' && isOverdue(todo.dueDate, today)
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-sm font-medium',
            todo.stage === 'DONE' && 'text-muted-foreground line-through',
          )}
        >
          {todo.title}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          <PriorityBadge priority={todo.priority} />
          {overdue ? <StageBadge stage={todo.stage} overdue /> : null}
        </div>
      </div>
      {todo.notes ? (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{todo.notes}</p>
      ) : null}
      {todo.completionKind ? (
        <p className="text-[11px] text-muted-foreground">
          {TODO_COMPLETION_LABELS[todo.completionKind]}
          {todo.completedByName ? ` · ${todo.completedByName}` : ''}
          {todo.completionNote ? ` — ${todo.completionNote}` : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <DeadlineLabel dueDate={todo.dueDate} overdue={overdue} done={todo.stage === 'DONE'} />
        <span>·</span>
        <PeopleLabel todo={todo} currentUserId={currentUserId} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        {canUpdate ? (
          <StageMoves todo={todo} busy={busy} onMove={onMove} onReopen={onReopen} />
        ) : (
          <span />
        )}
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            aria-label={`Delete ${todo.title}`}
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function StageMoves({
  todo,
  busy,
  onMove,
  onReopen,
}: {
  todo: Todo
  busy: boolean
  onMove: (id: string, stage: TodoStage) => void
  onReopen: () => void
}) {
  if (todo.stage === 'DONE') {
    return (
      <button
        type="button"
        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
        disabled={busy}
        onClick={onReopen}
      >
        Reopen
      </button>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {TODO_STAGES.filter((stage) => stage !== todo.stage).map((stage) => (
        <button
          key={stage}
          type="button"
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
          disabled={busy}
          onClick={() => onMove(todo.id, stage)}
        >
          → {TODO_STAGE_LABELS[stage]}
        </button>
      ))}
    </div>
  )
}

function PeopleLabel({ todo, currentUserId }: { todo: Todo; currentUserId: string }) {
  const sentToMe = todo.assigneeId === currentUserId && todo.ownerId !== currentUserId
  if (sentToMe) return <span>From {todo.ownerName}</span>
  if (todo.assigneeName) return <span>For {todo.assigneeName}</span>
  return <span>{todo.ownerName}</span>
}

function PriorityBadge({ priority }: { priority: TodoPriority }) {
  if (priority <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        priority >= 2
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
      )}
    >
      {TODO_PRIORITY_LABELS[priority]}
    </span>
  )
}

function StageBadge({ stage, overdue }: { stage: TodoStage; overdue?: boolean }) {
  if (overdue && stage !== 'DONE') {
    return (
      <span className="inline-flex rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        Overdue
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {TODO_STAGE_LABELS[stage]}
    </span>
  )
}

function DeadlineLabel({
  dueDate,
  overdue,
  done,
}: {
  dueDate: string | null
  overdue: boolean
  done: boolean
}) {
  if (!dueDate) {
    return <span className={done ? undefined : 'text-muted-foreground'}>No deadline</span>
  }
  return (
    <span className={cn(overdue && 'font-medium text-destructive')}>
      {overdue ? 'Was due ' : 'Due '}
      {formatDate(dueDate)}
    </span>
  )
}

function isOverdue(dueDate: string | null, today: CalendarDate): boolean {
  return Boolean(dueDate && isBefore(dueDate, today))
}
