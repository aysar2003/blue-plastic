'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { createProjectCommentForm } from '@/app/(app)/projects/actions'
import { idleState } from '@/components/forms/action-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/date'

type Comment = {
  id: string
  body: string
  createdAt: Date | string
  author: { id: string; name: string }
}

export function ProjectChatter({
  projectId,
  comments,
  canEdit,
}: {
  projectId: string
  comments: Comment[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createProjectCommentForm, idleState)

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [state, router])

  return (
    <section className="mb-8 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Chatter</h2>
        <p className="text-xs text-muted-foreground">Notes on this job — visible to your team.</p>
      </div>
      {canEdit ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Write a note…"
            className="flex min-h-[56px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="submit" size="sm" disabled={pending}>
            Post
          </Button>
          {state.status === 'error' && state.message ? (
            <p className="text-xs text-destructive">{state.message}</p>
          ) : null}
        </form>
      ) : null}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((row) => (
            <li key={row.id}>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">
                  {row.author.name} ·{' '}
                  {formatDateTime(
                    row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{row.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
