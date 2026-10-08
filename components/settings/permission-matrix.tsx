'use client'

import { PERMISSION_GROUPS, PERMISSIONS, type Permission } from '@/lib/permissions-catalog'
import { cn } from '@/lib/utils'

/** Soft accent per app — matches the home launcher tiles. */
const APP_ACCENT: Record<string, string> = {
  pos: '#714B67',
  sales: '#0F766E',
  customers: '#0369A1',
  purchases: '#C2410C',
  vendors: '#B45309',
  banking: '#047857',
  payments: '#0E7490',
  inventory: '#1D4ED8',
  stores: '#0F766E',
  accounting: '#1E3A5F',
  journals: '#334155',
  reports: '#BE123C',
  'bill-payments': '#A16207',
  periods: '#475569',
  settings: '#57534E',
}

/**
 * App-by-app permission matrix — same apps as the home launcher.
 * Used when inviting or editing a member’s access.
 */
export function PermissionMatrix({
  selected,
  onChange,
  disabled,
}: {
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
}) {
  function toggle(key: Permission, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(key)
    else next.delete(key)
    onChange(next)
  }

  function toggleGroup(keys: Permission[], checked: boolean) {
    const next = new Set(selected)
    for (const key of keys) {
      if (checked) next.add(key)
      else next.delete(key)
    }
    onChange(next)
  }

  function selectAll() {
    onChange(new Set(PERMISSIONS))
  }

  function clearAll() {
    onChange(new Set())
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tick the apps this person may open. Each row is one app from the home screen.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={selectAll}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
          >
            Select all apps
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={clearAll}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[min(28rem,55vh)] space-y-3 overflow-y-auto pr-1">
        {PERMISSION_GROUPS.map((group) => {
          const keys = group.permissions.map((p) => p.key)
          const selectedCount = keys.filter((k) => selected.has(k)).length
          const allOn = selectedCount === keys.length
          const someOn = selectedCount > 0 && !allOn
          const accent = APP_ACCENT[group.id] ?? '#57534E'

          return (
            <section key={group.id} className="overflow-hidden rounded-md border border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-0.5 size-2.5 shrink-0 rounded-sm"
                    style={{ background: accent }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--primary)]"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = someOn
                    }}
                    disabled={disabled}
                    onChange={(e) => toggleGroup(keys, e.target.checked)}
                  />
                  Whole app
                </label>
              </div>
              <ul className="grid gap-1 p-2 sm:grid-cols-2">
                {group.permissions.map((perm) => (
                  <li key={perm.key}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/40',
                        disabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary)]"
                        checked={selected.has(perm.key)}
                        disabled={disabled}
                        onChange={(e) => toggle(perm.key, e.target.checked)}
                      />
                      <span>
                        <span className="block leading-snug">{perm.label}</span>
                        <span className="block font-mono text-[0.65rem] text-muted-foreground">
                          {perm.key}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
