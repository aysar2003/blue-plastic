'use client'

import { useState } from 'react'
import {
  CheckIcon,
  DatabaseIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { companyGroupLabel, type CompanyGroupKind } from '@/lib/company-group'
import { cn } from '@/lib/utils'

export type CompanyOpenRow = {
  id: string
  name: string
  legalName: string | null
  baseCurrency: string
  role: string
  ownerName: string | null
  isCurrent: boolean
  updatedAt: string
  sizeBytes: number
  parentOrgId: string | null
  parentName: string | null
  childCount: number
  groupKind: CompanyGroupKind
}

type Props = {
  databases: CompanyOpenRow[]
  busyId?: string | null
  canConnect: boolean
  canCreate: boolean
  canDelete: boolean
  editList: boolean
  onEditListChange: (open: boolean) => void
  onOpen: (orgId: string, isCurrent: boolean) => void
  onCreate: () => void
  onOpenOrRestore: () => void
  onDelete: (row: CompanyOpenRow) => void
}

type GroupTree = {
  root: CompanyOpenRow
  children: CompanyOpenRow[]
}

function buildGroups(databases: CompanyOpenRow[]): {
  trees: GroupTree[]
  standalone: CompanyOpenRow[]
} {
  const byId = new Map(databases.map((row) => [row.id, row]))
  const childrenByParent = new Map<string, CompanyOpenRow[]>()
  for (const row of databases) {
    if (!row.parentOrgId) continue
    const list = childrenByParent.get(row.parentOrgId) ?? []
    list.push(row)
    childrenByParent.set(row.parentOrgId, list)
  }

  const trees: GroupTree[] = []
  const standalone: CompanyOpenRow[] = []

  for (const row of databases) {
    if (row.parentOrgId) continue
    const children = (childrenByParent.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    if (children.length > 0 || row.groupKind === 'main') {
      trees.push({ root: row, children })
    } else {
      standalone.push(row)
    }
  }

  // Orphan subs whose parent is not on this list.
  for (const row of databases) {
    if (!row.parentOrgId || byId.has(row.parentOrgId)) continue
    standalone.push(row)
  }

  trees.sort((a, b) => a.root.name.localeCompare(b.root.name))
  standalone.sort((a, b) => a.name.localeCompare(b.name))
  return { trees, standalone }
}

function cardMeta(row: CompanyOpenRow) {
  const parts: string[] = []
  if (row.ownerName) parts.push(row.ownerName)
  if (row.parentName) parts.push(`under ${row.parentName}`)
  else if (row.groupKind === 'main' && row.childCount > 0) {
    parts.push(`${row.childCount} sub${row.childCount === 1 ? '' : 's'}`)
  }
  parts.push(row.baseCurrency)
  return parts.join(' · ')
}

/** Bright mark — solid colours so Main / Sub / Solo stay readable on dark desks. */
function groupMark(kind: CompanyGroupKind) {
  if (kind === 'main') {
    return {
      stripe: 'border-l-[3px] border-l-teal-400',
      badge: 'bg-teal-400/25 text-teal-300 ring-1 ring-inset ring-teal-400/50',
      swatch: 'bg-teal-400',
    }
  }
  if (kind === 'sub') {
    return {
      stripe: 'border-l-[3px] border-l-amber-400',
      badge: 'bg-amber-400/25 text-amber-300 ring-1 ring-inset ring-amber-400/50',
      swatch: 'bg-amber-400',
    }
  }
  return {
    stripe: 'border-l-[3px] border-l-sky-400',
    badge: 'bg-sky-400/25 text-sky-300 ring-1 ring-inset ring-sky-400/50',
    swatch: 'bg-sky-400',
  }
}

/**
 * Databases home: every company on this system as a connectable card, plus a
 * map of how main and sub companies are linked.
 */
export function NoCompanyOpen({
  databases,
  busyId = null,
  canConnect,
  canCreate,
  canDelete,
  editList,
  onEditListChange,
  onOpen,
  onCreate,
  onOpenOrRestore,
  onDelete,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => databases.find((row) => row.isCurrent)?.id ?? databases[0]?.id ?? null,
  )

  const { trees, standalone } = buildGroups(databases)
  const hasLinks = trees.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My databases
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every company on this system. Connect opens its books. Staff never see this list.
          </p>
          {databases.length > 0 ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {(['main', 'sub', 'standalone'] as const).map((kind) => {
                const mark = groupMark(kind)
                return (
                  <span
                    key={kind}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide',
                      mark.badge,
                    )}
                  >
                    <span className={cn('size-2 rounded-full', mark.swatch)} />
                    {companyGroupLabel(kind)}
                  </span>
                )
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <>
              <Button type="button" variant="outline" onClick={onOpenOrRestore}>
                <DatabaseIcon />
                Backup &amp; restore
              </Button>
              <Button type="button" onClick={onCreate}>
                <PlusIcon />
                Create company
              </Button>
            </>
          ) : null}
          {canDelete || canCreate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditListChange(!editList)}
            >
              <PencilIcon />
              {editList ? 'Done' : 'Edit'}
            </Button>
          ) : null}
        </div>
      </div>

      {databases.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No companies yet. Create a company or import a backup to get started.
          </p>
          {canCreate ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={onCreate}>
                <PlusIcon />
                Create company
              </Button>
              <Button type="button" variant="outline" onClick={onOpenOrRestore}>
                <DatabaseIcon />
                Import backup
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {databases.map((row) => {
            const busy = busyId === row.id
            const canOpen = row.isCurrent || canConnect
            const selected = row.id === selectedId
            const group = companyGroupLabel(row.groupKind)
            const mark = groupMark(row.groupKind)

            return (
              <li key={row.id}>
                <article
                  className={cn(
                    'relative flex h-full min-h-[8.5rem] flex-col rounded-lg border bg-card p-4 pl-[1.05rem] transition',
                    row.isCurrent && 'border-primary/30 bg-muted/50',
                    selected && !row.isCurrent && 'ring-1 ring-border',
                    canOpen && 'cursor-pointer hover:border-primary/35 hover:bg-muted/30',
                    !canOpen && 'opacity-80',
                    // Last so Main / Sub / Solo left colour is never overridden.
                    mark.stripe,
                  )}
                  onClick={() => setSelectedId(row.id)}
                  onDoubleClick={() => {
                    if (canOpen) onOpen(row.id, row.isCurrent)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground',
                        row.isCurrent && 'border-primary/25 text-primary',
                      )}
                    >
                      <DatabaseIcon className="size-4" />
                    </span>
                    {row.isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground">
                        <CheckIcon className="size-3" />
                        Current
                      </span>
                    ) : canOpen ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-primary disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpen(row.id, row.isCurrent)
                        }}
                      >
                        {busy ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          'Connect'
                        )}
                      </button>
                    ) : (
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        Locked
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <h2 className="text-sm font-semibold uppercase leading-snug tracking-wide text-foreground">
                      {row.name}
                    </h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{cardMeta(row)}</p>
                    <span
                      className={cn(
                        'mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide',
                        mark.badge,
                      )}
                    >
                      {group}
                      {row.groupKind === 'main' && row.childCount > 0
                        ? ` · ${row.childCount}`
                        : null}
                    </span>
                  </div>

                  {editList ? (
                    <div
                      className="mt-3 flex flex-wrap gap-1.5 border-t pt-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.isCurrent ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onOpen(row.id, true)}
                        >
                          Open books
                        </Button>
                      ) : null}
                      <a
                        href={`/api/backup?orgId=${encodeURIComponent(row.id)}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Backup
                      </a>
                      {canDelete ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(row)}
                        >
                          <Trash2Icon />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {hasLinks || standalone.length > 0 ? (
        <section className="space-y-3 border-t pt-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">How companies are linked</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Main companies and their subs share a group for roll-up reports. Each still keeps its
              own books — Connect opens one at a time.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {trees.map(({ root, children }) => (
              <div
                key={root.id}
                className={cn(
                  'relative rounded-lg border border-l-[3px] border-l-teal-400 bg-card px-4 py-3 pl-[1.05rem]',
                  root.isCurrent || children.some((c) => c.isCurrent)
                    ? 'border-primary/25'
                    : null,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold uppercase tracking-wide">
                      {root.name}
                    </p>
                    <span className="mt-1 inline-flex items-center rounded-md bg-teal-400/25 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-teal-300 ring-1 ring-inset ring-teal-400/50">
                      Main · {children.length} sub{children.length === 1 ? '' : 's'}
                      {root.isCurrent ? ' · Current' : ''}
                    </span>
                  </div>
                  {(root.isCurrent || canConnect) && !root.isCurrent ? (
                    <button
                      type="button"
                      className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
                      disabled={busyId === root.id}
                      onClick={() => onOpen(root.id, root.isCurrent)}
                    >
                      Connect
                    </button>
                  ) : null}
                </div>
                {children.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 border-l-[3px] border-l-amber-400 pl-3">
                    {children.map((child) => (
                      <li
                        key={child.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium uppercase tracking-wide">{child.name}</span>
                          <span className="ml-2 inline-flex items-center rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/50">
                            Sub · {child.baseCurrency}
                            {child.isCurrent ? ' · Current' : ''}
                          </span>
                        </span>
                        {child.isCurrent ? (
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                            Current
                          </span>
                        ) : canConnect ? (
                          <button
                            type="button"
                            className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
                            disabled={busyId === child.id}
                            onClick={() => onOpen(child.id, child.isCurrent)}
                          >
                            Connect
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No sub-companies yet.</p>
                )}
              </div>
            ))}

            {standalone.length > 0 ? (
              <div className="relative rounded-lg border border-l-[3px] border-l-sky-400 bg-card px-4 py-3 pl-[1.05rem] lg:col-span-2">
                <p className="inline-flex items-center rounded-md bg-sky-400/25 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-300 ring-1 ring-inset ring-sky-400/50">
                  Solo companies
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {standalone.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={!(row.isCurrent || canConnect) || busyId === row.id}
                        onClick={() => onOpen(row.id, row.isCurrent)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-left text-xs transition',
                          row.isCurrent
                            ? 'border-primary/30 bg-primary/10 font-semibold text-foreground'
                            : 'hover:border-primary/35 hover:bg-muted/40',
                          !(row.isCurrent || canConnect) && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className="font-medium uppercase tracking-wide">{row.name}</span>
                        <span className="ml-1.5 text-muted-foreground">{row.baseCurrency}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
