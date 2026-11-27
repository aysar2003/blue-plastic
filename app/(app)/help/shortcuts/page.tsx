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
  const groups = ['Go to', 'Open', 'Create'] as const

  return (
    <>
      <PageHeader
        title="Keyboard shortcuts"
        description="Press g, then a letter, to go somewhere. Press o, then a letter, to open a board. Press c, then a letter, to create something. On an invoice or bill, Tab walks the form; Ctrl+S saves without the mouse."
      />

      <Card className="mb-4">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Sida loo isticmaalo (Somali)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Guji <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl</kbd>+
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">K</kbd> — raadso
              bog, customer, invoice, ama document kasta.
            </li>
            <li>
              Guji <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">G</kbd> ka
              dibna xaraf — u gudub bog (tusaale <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">G</kbd> then{' '}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">I</kbd> = invoices).
            </li>
            <li>
              Guji <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">O</kbd> ka
              dibna xaraf — fur board (Snapshot, Inventory, POS, Analytics…).
            </li>
            <li>
              Guji <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">C</kbd> ka
              dibna xaraf — abuuro document cusub (invoice, bill, journal…).
            </li>
            <li>
              Guji <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">?</kbd> —
              soo fur liiskan shortcuts.
            </li>
            <li>
              Forms: <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Tab</kbd>{' '}
              u gudub field-ka xiga ·{' '}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl</kbd>+
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">S</kbd> kaydi ·{' '}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">Ctrl</kbd>+
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6875rem]">L</kbd> ku dar
              line.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      key={`${shortcut.group}:${shortcut.href}`}
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
