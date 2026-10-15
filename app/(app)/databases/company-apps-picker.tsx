'use client'

import { Button } from '@/components/ui/button'
import {
  DEFAULT_FEATURE_FLAGS,
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  moduleActionFields as buildModuleActionFields,
  type ModuleFlag,
} from '@/lib/feature-flags'

/** Payload keys the Databases actions expect for company apps. */
export function moduleActionFields(modules: Record<ModuleFlag, boolean>) {
  return buildModuleActionFields(modules)
}

export function allModulesOn(): Record<ModuleFlag, boolean> {
  return { ...DEFAULT_FEATURE_FLAGS.modules }
}

export function hasAnyModuleOn(modules: Record<ModuleFlag, boolean>): boolean {
  return MODULE_FLAGS.some((key) => modules[key])
}

/**
 * ERP system-owner control: which apps a company may use.
 * Used when creating a company, approving a signup, or editing Limits.
 */
export function CompanyAppsPicker({
  modules,
  onChange,
  disabled = false,
  title = 'Apps for this company',
  hint = 'Turn apps on or off. You can grant all, or only the ones this company may use — and change that later under Limits.',
}: {
  modules: Record<ModuleFlag, boolean>
  onChange: (next: Record<ModuleFlag, boolean>) => void
  disabled?: boolean
  title?: string
  hint?: string
}) {
  function toggle(key: ModuleFlag) {
    onChange({ ...modules, [key]: !modules[key] })
  }

  function setAll(on: boolean) {
    const next = { ...modules }
    for (const key of MODULE_FLAGS) next[key] = on
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setAll(true)}
          >
            All on
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setAll(false)}
          >
            All off
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODULE_FLAGS.map((key) => (
          <label
            key={key}
            className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input"
              checked={modules[key]}
              disabled={disabled}
              onChange={() => toggle(key)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{MODULE_FLAG_LABELS[key].label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {MODULE_FLAG_LABELS[key].hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!hasAnyModuleOn(modules) ? (
        <p className="text-xs text-destructive">Leave at least one app on.</p>
      ) : null}
    </div>
  )
}
