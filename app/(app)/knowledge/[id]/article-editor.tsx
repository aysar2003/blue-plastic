'use client'

import { useActionState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { deleteArticle, updateArticleForm } from '@/app/(app)/knowledge/actions'
import { idleState } from '@/components/forms/action-state'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/date'

export function ArticleEditor({
  article,
  canUpdate,
  canDelete,
  timeZone,
}: {
  article: {
    id: string
    title: string
    body: string
    updatedAt: string
    createdByName: string | null
    updatedByName: string | null
  }
  canUpdate: boolean
  canDelete: boolean
  timeZone: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateArticleForm, idleState)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message ?? 'Saved')
    router.refresh()
  }, [state, router])

  function onDelete() {
    if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return
    startDelete(async () => {
      const result = await deleteArticle({ id: article.id })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Deleted')
      router.push('/knowledge')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/knowledge">Back</Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          Updated {formatDateTime(new Date(article.updatedAt), timeZone)}
          {article.updatedByName ? ` · ${article.updatedByName}` : ''}
          {article.createdByName ? ` · created by ${article.createdByName}` : ''}
        </p>
      </div>

      {canUpdate ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={article.id} />
          <Field label="Title" name="title" error={state.fieldErrors?.title} required>
            <Input id="title" name="title" required maxLength={200} defaultValue={article.title} />
          </Field>
          <Field label="Body" name="body" error={state.fieldErrors?.body}>
            <textarea
              id="body"
              name="body"
              rows={16}
              maxLength={50_000}
              defaultValue={article.body}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[280px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>
          {state.status === 'error' && state.message ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={deleting}
                onClick={onDelete}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <article className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{article.title}</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {article.body || '—'}
          </div>
        </article>
      )}
    </div>
  )
}
