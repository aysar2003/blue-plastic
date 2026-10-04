import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { formatKeys, GLOBAL_KEYS, SHORTCUTS } from '@/lib/shortcuts'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Keyboard shortcuts' }

export default async function ShortcutsPage() {
  const ctx = await requireOrgContext()

  const available = SHORTCUTS.filter(
    (shortcut) => !shortcut.permission || ctx.permissions.has(shortcut.permission),
  )
  const groups = ['Go to', 'Create'] as const

  return (
    <>
      <PageHeader
        title="Keyboard shortcuts"
        description="Press g, then a letter, to go somewhere. Press c, then a letter, to create something. A bar lists the letters while you choose. Saving, adding a line, and moving through a list work on every screen."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-0">
            <p className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anywhere
            </p>
            <ul className="divide-y">
              {GLOBAL_KEYS.map((entry) => (
                <li key={entry.keys} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 text-muted-foreground">{entry.label}</span>
                  <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">
                    {entry.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {groups.map((group) => (
          <Card key={group}>
            <CardContent className="p-0">
              <p className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <ul className="divide-y">
                {available
                  .filter((shortcut) => shortcut.group === group)
                  .map((shortcut) => (
                    <li
                      key={shortcut.href}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">{shortcut.label}</span>
                      <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">
                        {formatKeys(shortcut.keys)}
                      </kbd>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Everything here is also in the command palette — press{' '}
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">⌘K</kbd>, type a few letters,
        and press Enter. The palette is the way to find a shortcut you have not learnt yet.
      </p>
    </>
  )
}
