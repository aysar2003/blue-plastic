'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BellIcon, BookmarkIcon, PinIcon, RssIcon, SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'

import { removeBookmark, saveBookmark } from '@/app/(app)/workspace/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Bookmark = { id: string; label: string; href: string; kind: string }
type Task = { href: string; label: string }
type FeedItem = { id: string; entity: string; action: string; at: string; actor: string }

const GEAR = [
  { href: '/settings/organization', label: 'Organisation' },
  { href: '/accounts', label: 'Chart of accounts' },
  { href: '/settings/accounts', label: 'Default accounts' },
  { href: '/settings/tax', label: 'Tax' },
  { href: '/settings/users', label: 'Users' },
  { href: '/settings/appearance', label: 'Appearance' },
  { href: '/settings/backup', label: 'Backup' },
  { href: '/settings/activity', label: 'Activity log' },
]

export function ShellMenus() {
  const pathname = usePathname()
  const router = useRouter()
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [feed, setFeed] = useState<FeedItem[] | null>(null)

  async function load() {
    const response = await fetch('/api/workspace')
    if (!response.ok) return
    const data = (await response.json()) as { bookmarks: Bookmark[]; tasks: Task[]; feed: FeedItem[] }
    setBookmarks(data.bookmarks)
    setTasks(data.tasks)
    setFeed(data.feed)
  }

  const shortcuts = (bookmarks ?? []).filter((item) => item.kind === 'shortcut')
  const taskCount = tasks?.length ?? 0

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && load()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Shortcuts, feed and pins">
            <BookmarkIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <p className="px-2 py-1 text-xs font-semibold text-primary">Shortcuts</p>
          {shortcuts.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">None yet.</p>
          ) : (
            shortcuts.map((item) => (
              <DropdownMenuItem key={item.id} className="justify-between gap-2" onSelect={(event) => event.preventDefault()}>
                <Link href={item.href} className="min-w-0 flex-1 truncate">
                  {item.label}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    void removeBookmark({ id: item.id }).then((result) => {
                      if (!result.ok) toast.error(result.error.message)
                      else void load()
                    })
                  }}
                >
                  ×
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuItem
            onSelect={() => {
              const label = window.prompt('Name this shortcut', document.title.replace(/ · .*$/, ''))
              if (!label) return
              void saveBookmark({ label, href: pathname, kind: 'shortcut' }).then((result) => {
                if (!result.ok) toast.error(result.error.message)
                else {
                  toast.success('Shortcut saved.')
                  router.refresh()
                }
              })
            }}
          >
            Save this page
          </DropdownMenuItem>
          <p className="mt-2 px-2 py-1 text-xs font-semibold text-primary">
            <RssIcon className="mr-1 inline size-3" /> Feed
          </p>
          {(feed ?? []).slice(0, 8).map((item) => (
            <p key={item.id} className="px-2 py-1 text-xs text-muted-foreground">
              {item.actor} {item.action.toLowerCase()} {item.entity}
            </p>
          ))}
          {feed && feed.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">No activity yet.</p> : null}
          <DropdownMenuItem asChild>
            <Link href="/dashboard">All apps</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/reports">Reports</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => open && load()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Tasks" className="relative">
            <BellIcon />
            {taskCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] text-primary-foreground">
                {taskCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {(tasks ?? []).length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Nothing waiting.</p>
          ) : (
            tasks?.map((task) => (
              <DropdownMenuItem key={task.href + task.label} asChild>
                <Link href={task.href}>{task.label}</Link>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Settings">
            <SettingsIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {GEAR.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <PinButton pathname={pathname} />
    </>
  )
}

function PinButton({ pathname }: { pathname: string }) {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Pin this page on Home"
      onClick={() => {
        void saveBookmark({ label: document.title.replace(/ · .*$/, '') || 'Pinned', href: pathname, kind: 'pin' }).then(
          (result) => {
            if (!result.ok) toast.error(result.error.message)
            else {
              toast.success('Pinned on Home.')
              router.refresh()
            }
          },
        )
      }}
    >
      <PinIcon />
    </Button>
  )
}
