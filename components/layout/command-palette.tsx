'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeftIcon, SearchIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { addLineFromKeyboard, focusNextInGrid, moveListRow, saveFromKeyboard } from '@/lib/keyboard'
import { formatKeys, SHORTCUTS, type Shortcut } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { MODULES } from './nav-items'
import { startNavigationProgress } from './navigation-progress'

type Command = {
  id: string
  label: string
  group: string
  href: string
  keys?: string[]
}

/** Milliseconds a two-key sequence stays open before the first key is forgotten. */
const SEQUENCE_TIMEOUT = 900

/**
 * The command palette, and the keyboard shortcuts that reach it.
 *
 * One component owns both because they are the same list: every shortcut is a
 * command, and the palette is how somebody finds a command whose shortcut they
 * have not learnt yet. Two implementations would drift within a week.
 *
 * Keys are ignored while the user is typing into a field — a bookkeeper entering
 * a customer called "Gigi" should not be navigated away mid-word.
 */
export function CommandPalette({ permissions }: { permissions: string[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [remote, setRemote] = React.useState<Command[]>([])
  const [active, setActive] = React.useState(0)
  const [pending, setPending] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const openRef = React.useRef(open)
  const sequenceRef = React.useRef<string | null>(null)
  openRef.current = open

  const allowed = React.useMemo(() => new Set(permissions), [permissions])

  const commands = React.useMemo<Command[]>(() => {
    const permitted = (permission?: string) => !permission || allowed.has(permission)
    const shortcutFor = (href: string): Shortcut | undefined =>
      SHORTCUTS.find((shortcut) => shortcut.href === href)

    const navigation: Command[] = MODULES.filter((entry) => permitted(entry.permission)).flatMap(
      (entry) => {
        const tabs = (entry.tabs ?? []).filter((tab) => permitted(tab.permission))
        if (tabs.length === 0) {
          return [
            {
              id: entry.href,
              label: entry.label,
              group: 'Go to',
              href: entry.href,
              keys: shortcutFor(entry.href)?.keys,
            },
          ]
        }
        return tabs.map((tab) => ({
          id: `${entry.key}:${tab.href}`,
          label: `${entry.label} · ${tab.label}`,
          group: 'Go to',
          href: tab.href,
          keys: shortcutFor(tab.href)?.keys,
        }))
      },
    )

    const creates: Command[] = SHORTCUTS.filter(
      (shortcut) => shortcut.group === 'Create' && permitted(shortcut.permission),
    ).map((shortcut) => ({
      id: shortcut.href,
      label: shortcut.label,
      group: 'Create',
      href: shortcut.href,
      keys: shortcut.keys,
    }))

    return [...creates, ...navigation]
  }, [allowed])

  React.useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) {
      setRemote([])
      return
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(needle)}`)
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((data: { hits?: { label: string; href: string; group: string }[] }) => {
          setRemote(
            (data.hits ?? []).map((hit) => ({
              id: `hit:${hit.group}:${hit.href}:${hit.label}`,
              label: hit.label,
              group: hit.group,
              href: hit.href,
            })),
          )
        })
        .catch(() => setRemote([]))
    }, 180)
    return () => window.clearTimeout(handle)
  }, [query])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const local = !needle ? commands : commands.filter((command) => command.label.toLowerCase().includes(needle))
    const seen = new Set(local.map((command) => command.href))
    return [...local, ...remote.filter((command) => !seen.has(command.href))]
  }, [commands, query, remote])

  const go = React.useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      startNavigationProgress()
      router.push(href)
    },
    [router],
  )

  const listKey = `${open}|${query}`
  const [lastListKey, setLastListKey] = React.useState(listKey)
  if (listKey !== lastListKey) {
    setLastListKey(listKey)
    setActive(0)
  }

  React.useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const waiting = React.useMemo(
    () =>
      pending
        ? SHORTCUTS.filter(
            (shortcut) =>
              shortcut.keys[0] === pending && (!shortcut.permission || allowed.has(shortcut.permission)),
          )
        : [],
    [allowed, pending],
  )

  // --- The global key handler ----------------------------------------------
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const forget = () => {
      sequenceRef.current = null
      clearTimeout(timer)
      setPending(null)
    }

    const isTyping = () => {
      const element = document.activeElement as HTMLElement | null
      if (!element) return false
      return (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT' ||
        element.isContentEditable
      )
    }

    const dialogOpen = () => document.querySelector('[role="dialog"]') !== null

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k' && !event.altKey) {
        event.preventDefault()
        forget()
        setOpen((wasOpen) => !wasOpen)
        return
      }

      // Save and add-line work while a field is focused. The browser's own
      // Ctrl+S would otherwise offer to save the page.
      if ((event.metaKey || event.ctrlKey) && key === 's' && !event.altKey && !openRef.current) {
        event.preventDefault()
        saveFromKeyboard(event.shiftKey)
        return
      }

      if ((event.metaKey || event.ctrlKey) && key === 'l' && !event.altKey && !event.shiftKey && !openRef.current) {
        if (addLineFromKeyboard()) event.preventDefault()
        return
      }

      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        const element = document.activeElement
        if (
          !event.defaultPrevented &&
          element instanceof HTMLElement &&
          focusNextInGrid(element)
        ) {
          event.preventDefault()
        }
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape') {
        if (sequenceRef.current) {
          event.preventDefault()
          forget()
          return
        }
        if (!dialogOpen() && isTyping()) {
          event.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
        return
      }

      if (isTyping() || dialogOpen() || openRef.current) return

      if (sequenceRef.current) {
        const match = SHORTCUTS.find(
          (shortcut) =>
            shortcut.keys.length === 2 &&
            shortcut.keys[0] === sequenceRef.current &&
            shortcut.keys[1] === key &&
            (!shortcut.permission || allowed.has(shortcut.permission)),
        )
        forget()
        if (match) {
          event.preventDefault()
          go(match.href)
        }
        return
      }

      if (event.key === 'ArrowDown' || key === 'j') {
        if (moveListRow(1)) event.preventDefault()
        return
      }
      if (event.key === 'ArrowUp' || key === 'k') {
        if (moveListRow(-1)) event.preventDefault()
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        forget()
        go('/help/shortcuts')
        return
      }

      if (event.key === '/') {
        const search = document.querySelector<HTMLInputElement>('input[type="search"], [data-page-search]')
        if (search) {
          event.preventDefault()
          search.focus()
          search.select()
        }
        return
      }

      if (SHORTCUTS.some((shortcut) => shortcut.keys[0] === key)) {
        sequenceRef.current = key
        setPending(key)
        clearTimeout(timer)
        timer = setTimeout(forget, SEQUENCE_TIMEOUT)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(timer)
    }
  }, [allowed, go])

  let renderedGroup: string | undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-8 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        )}
      >
        <SearchIcon className="size-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[0.625rem] font-medium sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0" size="md">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search for a page to go to or a document to create.
          </DialogDescription>

          <div className="flex items-center gap-2 border-b px-4">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActive((index) => Math.min(index + 1, filtered.length - 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActive((index) => Math.max(index - 1, 0))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  const command = filtered[active]
                  if (command) go(command.href)
                }
              }}
              placeholder="Search transactions, people, help, or a page…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Nothing matches that.</p>
            ) : null}

            {filtered.map((command, index) => {
              const heading = command.group !== renderedGroup ? command.group : null
              if (heading) renderedGroup = command.group

              return (
                <React.Fragment key={command.id}>
                  {heading ? (
                    <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {heading}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-active={index === active}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => go(command.href)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm',
                      index === active ? 'bg-accent text-accent-foreground' : '',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                    {command.keys ? (
                      <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                        {formatKeys(command.keys)}
                      </kbd>
                    ) : null}
                    {index === active ? (
                      <CornerDownLeftIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {waiting.length > 0 ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 rounded-lg border border-primary/20 bg-white/95 p-2 shadow-lg backdrop-blur-md print:hidden"
        >
          <span className="px-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {pending === 'c' ? 'Create' : 'Go to'}
          </span>
          {waiting.map((shortcut) => (
            <button
              key={shortcut.href}
              type="button"
              onClick={() => {
                sequenceRef.current = null
                setPending(null)
                go(shortcut.href)
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs text-slate-700 hover:bg-primary/20"
            >
              <kbd className="rounded bg-primary px-1 py-0.5 text-[0.625rem] font-semibold text-primary-foreground">
                {shortcut.keys[1]?.toUpperCase()}
              </kbd>
              {shortcut.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}
