'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MODULES, moduleFor, tabFor } from './nav-items'

/**
 * Modules, with their screens nested underneath.
 *
 * Only one module is open at a time. Opening another closes the one that was
 * open; the chevron can also shut the current drawer without navigating away.
 * Arriving somewhere always opens that module so you can see what else is there.
 *
 * Client only because it reads the active pathname. The permission filtering
 * happened on the server: this receives an allow-list of module keys and
 * permissions and cannot widen either.
 */
export function SidebarNav({
  allowed,
  permissions,
  onNavigate,
}: {
  allowed: string[]
  permissions: string[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const allowedModules = new Set(allowed)
  const allowedPermissions = new Set(permissions)
  const current = moduleFor(pathname)

  // Which module is open. Null means "the one the page is in". Empty string
  // means the user closed it on purpose — even the active module stays shut
  // until they open something again.
  const [opened, setOpened] = React.useState<string | null>(null)

  const [lastModule, setLastModule] = React.useState(current?.key)
  if (current?.key !== lastModule) {
    setLastModule(current?.key)
    // Land in a module → open that one (and only that one).
    setOpened(null)
  }

  return (
    <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-2.5">
      {MODULES.filter((entry) => allowedModules.has(entry.key)).map((entry) => {
        const active = current?.key === entry.key
        const Icon = entry.icon
        const children = (entry.tabs ?? []).filter(
          (tab) => !tab.permission || allowedPermissions.has(tab.permission),
        )
        const expanded = children.length > 1 && (opened === entry.key || (opened === null && active))
        const activeTab = active && current ? tabFor(current, pathname) : undefined

        return (
          <div key={entry.key}>
            <div
              className={cn(
                'flex items-center rounded-md transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/50',
              )}
            >
              <Link
                href={entry.href}
                // Clicking the module opens it (alone) as well as going there.
                onClick={() => {
                  setOpened(entry.key)
                  onNavigate?.()
                }}
                aria-current={active && !activeTab ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-[0.8125rem]',
                  active && 'font-semibold',
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                <span className="truncate">{entry.label}</span>
              </Link>

              {children.length > 1 ? (
                <button
                  type="button"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${entry.label}`}
                  aria-expanded={expanded}
                  // The chevron only opens and closes. Opening one closes the
                  // previous; closing leaves none open until the next choice.
                  onClick={() => setOpened(expanded ? '' : entry.key)}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <ChevronDownIcon
                    className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
                  />
                </button>
              ) : null}
            </div>

            {expanded ? (
              // Indented against a rule, so the list reads as belonging to the
              // module above it rather than as more top-level entries.
              <ul className="my-px ml-[1.4rem] space-y-px border-l pl-2">
                {children.map((tab) => {
                  const isActive = activeTab?.href === tab.href
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-md px-2 py-1 text-[0.8125rem] transition-colors',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
                        )}
                      >
                        {tab.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
