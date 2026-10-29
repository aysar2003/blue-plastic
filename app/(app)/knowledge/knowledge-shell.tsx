'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Share2Icon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createFromTemplate,
  duplicateArticle,
  lockArticle,
  moveArticle,
  purgeArticle,
  quickCreateArticle,
  restoreArticle,
  restoreRevision,
  setArticleCover,
  setArticleIcon,
  toggleFavorite,
  trashArticle,
  unlockArticle,
  updateArticle,
} from '@/app/(app)/knowledge/actions'
import { KnowledgeEditor } from '@/components/knowledge/editor'
import { KnowledgeShareDialog } from '@/components/knowledge/share-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/date'
import { KNOWLEDGE_ICONS, KNOWLEDGE_TEMPLATES } from '@/lib/knowledge-templates'
import { cn } from '@/lib/utils'

export type TreeNode = {
  id: string
  title: string
  scope: 'WORKSPACE' | 'SHARED' | 'PRIVATE'
  parentId: string | null
  icon: string | null
  favorite: boolean
  children: TreeNode[]
}

type Article = {
  id: string
  title: string
  body: string
  scope: 'WORKSPACE' | 'SHARED' | 'PRIVATE'
  parentId: string | null
  icon: string | null
  coverUrl: string | null
  lockedAt: string | null
  lockedByName: string | null
  deletedAt: string | null
  favorite: boolean
  canEdit: boolean
  shares: Array<{ userId: string; name: string; canEdit: boolean }>
  updatedAt: string
  createdByName: string | null
  updatedByName: string | null
}

type Revision = {
  id: string
  title: string
  createdAt: string
  createdByName: string | null
}

type Member = { id: string; name: string; email: string }

function TreeList({
  nodes,
  activeId,
  canCreate,
  onNested,
  depth = 0,
}: {
  nodes: TreeNode[]
  activeId?: string | null
  canCreate?: boolean
  onNested?: (parentId: string, scope: TreeNode['scope']) => void
  depth?: number
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (nodes.length === 0) return null
  return (
    <ul className={cn(depth > 0 && 'ml-2 border-l border-border/70 pl-1.5')}>
      {nodes.map((node) => {
        const expanded = open[node.id] ?? depth < 2
        return (
          <li key={node.id} className="group/tree">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                aria-label={expanded ? 'Collapse' : 'Expand'}
                onClick={() => setOpen((prev) => ({ ...prev, [node.id]: !expanded }))}
              >
                {node.children.length > 0 ? (
                  expanded ? (
                    <ChevronDownIcon className="size-3.5" />
                  ) : (
                    <ChevronRightIcon className="size-3.5" />
                  )
                ) : (
                  <span className="inline-block size-3.5" />
                )}
              </button>
              <Link
                href={`/knowledge/${node.id}`}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-muted',
                  activeId === node.id && 'bg-muted font-medium',
                )}
              >
                <span className="shrink-0 text-sm">{node.icon || '📄'}</span>
                <span className="truncate">{node.title || 'Untitled'}</span>
                {node.favorite ? (
                  <StarIcon className="ml-auto size-3 shrink-0 fill-amber-400 text-amber-500" />
                ) : null}
              </Link>
              {canCreate && onNested ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/tree:opacity-100"
                  aria-label="Add nested page"
                  onClick={() => onNested(node.id, node.scope)}
                >
                  <PlusIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
            {expanded ? (
              <TreeList
                nodes={node.children}
                activeId={activeId}
                canCreate={canCreate}
                onNested={onNested}
                depth={depth + 1}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function Section({
  label,
  nodes,
  activeId,
  onAdd,
  canCreate,
  onNested,
}: {
  label: string
  nodes: TreeNode[]
  activeId?: string | null
  onAdd?: () => void
  canCreate?: boolean
  onNested?: (parentId: string, scope: TreeNode['scope']) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        {canCreate && onAdd ? (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`New ${label} article`}
            onClick={onAdd}
          >
            <PlusIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      {nodes.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">Empty</p>
      ) : (
        <TreeList nodes={nodes} activeId={activeId} canCreate={canCreate} onNested={onNested} />
      )}
    </div>
  )
}

export function KnowledgeShell({
  workspace,
  shared,
  privateTree,
  favorites,
  trash,
  trashCount,
  trashMode,
  article,
  revisions,
  members,
  canCreate,
  canUpdate,
  canDelete,
  timeZone,
  initialQuery,
}: {
  workspace: TreeNode[]
  shared: TreeNode[]
  privateTree: TreeNode[]
  favorites: TreeNode[]
  trash: TreeNode[]
  trashCount: number
  trashMode?: boolean
  article: Article | null
  revisions: Revision[]
  members: Member[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  timeZone: string
  initialQuery?: string | null
}) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [title, setTitle] = useState(article?.title ?? '')
  const [body, setBody] = useState(article?.body ?? '<p></p>')
  const [busy, startBusy] = useTransition()
  const [shareOpen, setShareOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [coverDraft, setCoverDraft] = useState(article?.coverUrl ?? '')

  useEffect(() => {
    setTitle(article?.title ?? '')
    setBody(article?.body ?? '<p></p>')
    setCoverDraft(article?.coverUrl ?? '')
  }, [article?.id, article?.title, article?.body, article?.coverUrl])

  function search() {
    const q = query.trim()
    const base = trashMode ? '/knowledge?trash=1' : '/knowledge'
    router.push(q ? `${base}${trashMode ? '&' : '?'}q=${encodeURIComponent(q)}` : base)
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: { message: string }; data?: { id?: string } }>) {
    startBusy(async () => {
      const result = await fn()
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Failed')
        return
      }
      toast.success(label)
      if (result.data?.id && label !== 'Trashed' && label !== 'Deleted forever') {
        router.push(`/knowledge/${result.data.id}`)
      } else if (label === 'Trashed' || label === 'Deleted forever') {
        router.push('/knowledge')
      }
      router.refresh()
    })
  }

  function quickNew(scope: TreeNode['scope'], parentId?: string | null) {
    run('Article created', async () => quickCreateArticle(scope, parentId))
  }

  function save() {
    if (!article) return
    run('Saved', async () => updateArticle({ id: article.id, title: title.trim() || 'Untitled', body }))
  }

  const editable = Boolean(article && article.canEdit && !article.lockedAt && !article.deletedAt && canUpdate)

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex max-h-[calc(100vh-8rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3">
        <div className="flex gap-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                search()
              }
            }}
            placeholder="Search…"
            className="h-8"
            aria-label="Search knowledge"
          />
          <Button type="button" size="icon-sm" variant="outline" onClick={search} aria-label="Search">
            <SearchIcon className="size-3.5" />
          </Button>
        </div>

        {trashMode ? (
          <Section label="Trash" nodes={trash} activeId={article?.id} />
        ) : (
          <>
            <Section label="Favorites" nodes={favorites} activeId={article?.id} />
            <Section
              label="Workspace"
              nodes={workspace}
              activeId={article?.id}
              canCreate={canCreate}
              onAdd={() => quickNew('WORKSPACE')}
              onNested={(id, scope) => quickNew(scope, id)}
            />
            <Section
              label="Shared"
              nodes={shared}
              activeId={article?.id}
              canCreate={canCreate}
              onAdd={() => quickNew('SHARED')}
              onNested={(id, scope) => quickNew(scope, id)}
            />
            <Section
              label="Private"
              nodes={privateTree}
              activeId={article?.id}
              canCreate={canCreate}
              onAdd={() => quickNew('PRIVATE')}
              onNested={(id, scope) => quickNew(scope, id)}
            />
          </>
        )}

        <div className="mt-auto space-y-1 border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setTemplatesOpen((value) => !value)}
          >
            Browse templates
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href={trashMode ? '/knowledge' : '/knowledge?trash=1'}>
              {trashMode ? 'Back to Knowledge' : `Open the Trash (${trashCount})`}
            </Link>
          </Button>
        </div>

        {templatesOpen && canCreate ? (
          <ul className="space-y-1 rounded-md border border-border p-2">
            {KNOWLEDGE_TEMPLATES.map((template) => (
              <li key={template.key}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  disabled={busy}
                  onClick={() =>
                    run('Template loaded', async () =>
                      createFromTemplate({ templateKey: template.key, scope: 'WORKSPACE' }),
                    )
                  }
                >
                  <span className="mr-1">{template.icon}</span>
                  <span className="font-medium">{template.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{template.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      <section className="min-w-0 space-y-3">
        {!article ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {trashMode
                ? 'Pick a trashed article to restore or delete forever.'
                : initialQuery
                  ? 'No articles match that search.'
                  : 'Pick a page on the left, or create one in Workspace, Shared, or Private.'}
            </p>
            {!trashMode && canCreate ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" disabled={busy} onClick={() => quickNew('WORKSPACE')}>
                  New Workspace article
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setTemplatesOpen(true)}>
                  Browse templates
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {article.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverUrl}
                alt=""
                className="h-36 w-full rounded-md object-cover"
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={trashMode ? '/knowledge?trash=1' : '/knowledge'}>All</Link>
              </Button>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {article.scope === 'PRIVATE' ? 'Private' : article.scope === 'SHARED' ? 'Shared' : 'Workspace'}
              </span>
              {article.lockedAt ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Locked{article.lockedByName ? ` · ${article.lockedByName}` : ''}
                </span>
              ) : null}
              {article.deletedAt ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  In trash
                </span>
              ) : null}

              {!article.deletedAt ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className={cn(article.favorite && 'text-amber-600')}
                    onClick={() => run(article.favorite ? 'Unfavorited' : 'Favorited', async () => toggleFavorite({ id: article.id }))}
                  >
                    <StarIcon className={cn('mr-1 size-3.5', article.favorite && 'fill-amber-400')} />
                    Favorite
                  </Button>
                  {canUpdate ? (
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setShareOpen(true)}>
                      <Share2Icon className="mr-1 size-3.5" />
                      Share
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryOpen((value) => !value)}>
                    <HistoryIcon className="mr-1 size-3.5" />
                    History
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="ghost" aria-label="More">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canCreate ? (
                        <DropdownMenuItem
                          onClick={() => run('Copied to Private', async () => duplicateArticle({ id: article.id }))}
                        >
                          Create a copy
                        </DropdownMenuItem>
                      ) : null}
                      {canUpdate && !article.parentId ? (
                        <>
                          <DropdownMenuItem onClick={() => run('Moved', async () => moveArticle({ id: article.id, scope: 'WORKSPACE' }))}>
                            Move to Workspace
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => run('Moved', async () => moveArticle({ id: article.id, scope: 'SHARED' }))}>
                            Move to Shared
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => run('Moved', async () => moveArticle({ id: article.id, scope: 'PRIVATE' }))}>
                            Move to Private
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {canUpdate ? (
                        article.lockedAt ? (
                          <DropdownMenuItem onClick={() => run('Unlocked', async () => unlockArticle({ id: article.id }))}>
                            Unlock
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => run('Locked', async () => lockArticle({ id: article.id }))}>
                            Lock content
                          </DropdownMenuItem>
                        )
                      ) : null}
                      <DropdownMenuSeparator />
                      {canDelete ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (!window.confirm('Send to Trash? Nested pages go with it.')) return
                            run('Trashed', async () => trashArticle({ id: article.id }))
                          }}
                        >
                          Send to Trash
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex gap-2">
                  {canUpdate ? (
                    <Button type="button" size="sm" disabled={busy} onClick={() => run('Restored', async () => restoreArticle({ id: article.id }))}>
                      Restore
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Delete forever? This cannot be undone.')) return
                        run('Deleted forever', async () => purgeArticle({ id: article.id }))
                      }}
                    >
                      <Trash2Icon className="mr-1 size-3.5" />
                      Delete forever
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            {editable ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {KNOWLEDGE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-base hover:bg-muted',
                        article.icon === icon && 'border-primary bg-muted',
                      )}
                      onClick={() => run('Icon updated', async () => setArticleIcon({ id: article.id, icon }))}
                    >
                      {icon}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => run('Icon cleared', async () => setArticleIcon({ id: article.id, icon: null }))}
                  >
                    Clear
                  </button>
                </div>
                <form
                  className="flex min-w-[12rem] flex-1 gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    run('Cover saved', async () => setArticleCover({ id: article.id, coverUrl: coverDraft || null }))
                  }}
                >
                  <Input
                    value={coverDraft}
                    onChange={(event) => setCoverDraft(event.target.value)}
                    placeholder="Cover image URL…"
                    className="h-8"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={busy}>
                    Cover
                  </Button>
                </form>
              </div>
            ) : null}

            <div className="flex items-start gap-2">
              <span className="pt-1 text-3xl">{article.icon || '📄'}</span>
              {editable ? (
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                  placeholder="Untitled"
                />
              ) : (
                <h2 className="text-2xl font-semibold tracking-tight">{article.title || 'Untitled'}</h2>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Updated {formatDateTime(new Date(article.updatedAt), timeZone)}
              {article.updatedByName ? ` · ${article.updatedByName}` : ''}
            </p>

            <KnowledgeEditor content={body} editable={editable} onChange={setBody} />

            {editable ? (
              <Button type="button" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            ) : null}

            {historyOpen ? (
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-sm font-medium">Version history</p>
                {revisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No earlier versions yet. Save once to start history.</p>
                ) : (
                  <ul className="space-y-1">
                    {revisions.map((revision) => (
                      <li key={revision.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {revision.title || 'Untitled'}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatDateTime(new Date(revision.createdAt), timeZone)}
                            {revision.createdByName ? ` · ${revision.createdByName}` : ''}
                          </span>
                        </span>
                        {editable ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run('Restored version', async () =>
                                restoreRevision({ id: article.id, revisionId: revision.id }),
                              )
                            }
                          >
                            Restore
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {article && !article.deletedAt ? (
        <KnowledgeShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          articleId={article.id}
          shares={article.shares}
          members={members}
          onDone={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
