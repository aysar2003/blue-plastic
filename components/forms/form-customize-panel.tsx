'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  Columns3Icon,
  LayoutTemplateIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import {
  deleteFormTemplate,
  setActiveFormTemplate,
  upsertFormTemplate,
} from '@/app/(app)/settings/(work)/organization/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { FormColumnDef, FormFieldDef } from '@/lib/form-field-catalog'
import {
  SYSTEM_FORM_TEMPLATE_ID,
  type FormFamilyKey,
  type FormTemplate,
} from '@/lib/form-templates'
import { cn } from '@/lib/utils'

export type FormCustomizePanelProps = {
  family: FormFamilyKey
  templates: FormTemplate[]
  activeId: string
  /** Live draft of the active template (fields/columns). */
  draft: FormTemplate
  onDraftChange: (next: FormTemplate) => void
  fieldCatalog: FormFieldDef[]
  columnCatalog: FormColumnDef[]
  categoryColumnCatalog?: FormColumnDef[]
  canManage: boolean
  /** Optional layout skins (sales only). */
  layoutOptions?: readonly { id: string; label: string; blurb: string }[]
  className?: string
}

export function FormCustomizePanel({
  family,
  templates,
  activeId,
  draft,
  onDraftChange,
  fieldCatalog,
  columnCatalog,
  categoryColumnCatalog,
  canManage,
  layoutOptions,
  className,
}: FormCustomizePanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const current = useMemo(
    () => templates.find((row) => row.id === activeId) ?? templates[0],
    [templates, activeId],
  )

  const persist = (template: FormTemplate, makeActive: boolean) => {
    if (!canManage) {
      toast.error('You do not have permission to change company form templates.')
      return
    }
    startTransition(async () => {
      const result = await upsertFormTemplate({
        family,
        template: {
          id: template.id,
          name: template.name,
          layoutId: template.layoutId,
          fields: template.fields,
          columns: template.columns,
          categoryColumns: template.categoryColumns,
        },
        makeActive,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Company form template saved.')
      router.refresh()
    })
  }

  const switchTemplate = (templateId: string) => {
    if (templateId === activeId) return
    if (!canManage) {
      toast.error('You do not have permission to change the company form template.')
      return
    }
    startTransition(async () => {
      const result = await setActiveFormTemplate({ family, templateId })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Company form template updated.')
      router.refresh()
    })
  }

  const removeTemplate = (templateId: string) => {
    if (!canManage || templateId === SYSTEM_FORM_TEMPLATE_ID) return
    startTransition(async () => {
      const result = await deleteFormTemplate({ family, templateId })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Template removed.')
      router.refresh()
    })
  }

  /** Toggle a field/column; forks system into a company template on first edit. */
  const applyVisibility = (
    kind: 'fields' | 'columns' | 'categoryColumns',
    id: string,
    locked: boolean | undefined,
  ) => {
    if (locked) return
    if (!canManage) {
      toast.error('You do not have permission to customize this form.')
      return
    }
    const bag =
      kind === 'fields'
        ? { ...draft.fields }
        : kind === 'columns'
          ? { ...draft.columns }
          : { ...(draft.categoryColumns ?? {}) }
    bag[id] = bag[id] === false
    const next: FormTemplate = {
      ...draft,
      fields: kind === 'fields' ? bag : draft.fields,
      columns: kind === 'columns' ? bag : draft.columns,
      categoryColumns: kind === 'categoryColumns' ? bag : draft.categoryColumns,
    }

    if (draft.id === SYSTEM_FORM_TEMPLATE_ID) {
      const forked: FormTemplate = {
        ...next,
        id: crypto.randomUUID().slice(0, 36),
        name: 'Custom',
      }
      onDraftChange(forked)
      persist(forked, true)
      return
    }

    onDraftChange(next)
    persist(next, true)
  }

  const saveAsNew = () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Give the template a name.')
      return
    }
    const created: FormTemplate = {
      ...draft,
      id: crypto.randomUUID().slice(0, 36),
      name,
    }
    onDraftChange(created)
    persist(created, true)
    setSaveAsOpen(false)
    setNewName('')
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 print:hidden', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={pending}>
            <LayoutTemplateIcon />
            {current?.name ?? 'Template'}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {templates.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => switchTemplate(option.id)}
              className="items-start py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {option.id === SYSTEM_FORM_TEMPLATE_ID
                    ? 'Built-in company default'
                    : 'Company template'}
                </span>
              </span>
              {option.id === activeId ? <CheckIcon className="mt-0.5" /> : null}
            </DropdownMenuItem>
          ))}
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setNewName(draft.name === 'System default' ? '' : `${draft.name} copy`)
                  setSaveAsOpen(true)
                }}
              >
                <PlusIcon />
                Save as new template…
              </DropdownMenuItem>
              {draft.id !== SYSTEM_FORM_TEMPLATE_ID ? (
                <DropdownMenuItem
                  onSelect={() => removeTemplate(draft.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2Icon />
                  Delete this template
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setCustomizeOpen(true)}
      >
        <Columns3Icon className="size-4" />
        Customize
      </Button>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent
          size="sm"
          className={cn(
            'left-auto right-3 top-28 flex w-full max-w-md translate-x-0 translate-y-0 flex-col overflow-hidden rounded-lg border shadow-xl',
            'max-h-[calc(100svh-8rem)] sm:left-auto sm:right-4 sm:top-32 sm:max-h-[calc(100svh-9rem)] sm:translate-x-0 sm:translate-y-0',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          )}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Customize form</DialogTitle>
            <DialogDescription>
              Show or hide fields and columns. Changes save as a company template for everyone.
            </DialogDescription>
          </DialogHeader>

          {layoutOptions && layoutOptions.length > 0 ? (
            <div className="mb-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Layout
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {layoutOptions.map((option) => {
                  const active = (draft.layoutId ?? 'sheet') === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!canManage || pending}
                      onClick={() => {
                        if (!canManage) return
                        const next = { ...draft, layoutId: option.id }
                        if (draft.id === SYSTEM_FORM_TEMPLATE_ID) {
                          const forked = {
                            ...next,
                            id: crypto.randomUUID().slice(0, 36),
                            name: 'Custom',
                          }
                          onDraftChange(forked)
                          persist(forked, true)
                          return
                        }
                        onDraftChange(next)
                        persist(next, true)
                      }}
                      className={cn(
                        'rounded-lg border px-2.5 py-2 text-left text-sm transition',
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">
                        {option.blurb}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <ToggleGroup
            title="Fields"
            items={fieldCatalog}
            visibility={draft.fields}
            disabled={!canManage || pending}
            onToggle={(id) => applyVisibility('fields', id, false)}
          />

          <ToggleGroup
            title="Line columns"
            items={columnCatalog}
            visibility={draft.columns}
            disabled={!canManage || pending}
            onToggle={(id, locked) => applyVisibility('columns', id, locked)}
          />

          {categoryColumnCatalog && categoryColumnCatalog.length > 0 ? (
            <ToggleGroup
              title="Category columns"
              items={categoryColumnCatalog}
              visibility={draft.categoryColumns ?? {}}
              disabled={!canManage || pending}
              onToggle={(id, locked) => applyVisibility('categoryColumns', id, locked)}
            />
          ) : null}

          {!canManage ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You can see the company template. Ask an admin to change it.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Save as new template</DialogTitle>
            <DialogDescription>
              Creates a company template everyone can switch to on this form.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Template name"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveAsNew()
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={saveAsNew}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleGroup({
  title,
  items,
  visibility,
  disabled,
  onToggle,
}: {
  title: string
  items: { id: string; label: string; locked?: boolean }[]
  visibility: Record<string, boolean>
  disabled: boolean
  onToggle: (id: string, locked?: boolean) => void
}) {
  return (
    <div className="mb-3 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const checked = visibility[item.id] !== false
          return (
            <li key={item.id} className="flex items-center gap-2 rounded-md border bg-background px-2 py-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || item.locked}
                  onChange={() => onToggle(item.id, item.locked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span className="truncate">{item.label}</span>
                {item.locked ? (
                  <span className="text-[0.65rem] text-muted-foreground">Always on</span>
                ) : null}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
