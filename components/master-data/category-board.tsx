'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GitMergeIcon,
  Loader2Icon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  createCategory,
  deleteCategory,
  mergeCategories,
  updateCategory,
} from '@/app/(app)/items/actions'
import { Field } from '@/components/forms/field'
import { MergeIntoDialog } from '@/components/master-data/merge-into-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatMoney } from '@/lib/money'
import { STANDARD_ITEM_CATEGORIES } from '@/lib/standard-categories'

export type CategoryCard = {
  id: string
  name: string
  itemCount: number
  totalCost: string
  onHand: string
}

const CUSTOM = '__custom__'

export function NewCategoryButton({
  existingNames,
}: {
  existingNames: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New category
      </Button>
      {open ? (
        <CategoryFormDialog
          mode="create"
          existingCategories={existingNames.map((name) => ({ id: '', name, itemCount: 0 }))}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function CategoryBoard({
  categories,
  currency,
  canManage,
}: {
  categories: CategoryCard[]
  currency: string
  canManage: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((category) => (
        <CategoryCardView
          key={category.id}
          category={category}
          currency={currency}
          canManage={canManage}
          existingCategories={categories}
        />
      ))}
    </div>
  )
}

function CategoryCardView({
  category,
  currency,
  canManage,
  existingCategories,
}: {
  category: CategoryCard
  currency: string
  canManage: boolean
  existingCategories: CategoryCard[]
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [merging, setMerging] = useState(false)
  const hasItems = category.itemCount > 0
  const canMerge = existingCategories.some((row) => row.id !== category.id)

  return (
    <>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/items/categories/${category.id}`}
                className="font-medium text-card-foreground hover:text-primary hover:underline"
              >
                {category.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasItems
                  ? `${category.itemCount} item${category.itemCount === 1 ? '' : 's'}`
                  : 'No items yet'}
              </p>
            </div>
            {canManage ? (
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => setEditing(true)}
                >
                  <PencilIcon />
                </Button>
                {canMerge ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Merge ${category.name}`}
                    title={`Merge ${category.name} into another category`}
                    onClick={() => setMerging(true)}
                  >
                    <GitMergeIcon />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${category.name}`}
                  disabled={hasItems}
                  title={
                    hasItems
                      ? 'Move or remove items in this category before deleting it.'
                      : `Delete ${category.name}`
                  }
                  onClick={() => setDeleting(true)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Items</dt>
              <dd className="tabular font-medium text-card-foreground">{category.itemCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total cost</dt>
              <dd className="tabular font-semibold text-primary">
                {formatMoney(category.totalCost, currency)}
              </dd>
            </div>
          </dl>

          <Link
            href={`/items/categories/${category.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            <PackageIcon className="size-3.5" />
            Open shelf
          </Link>
        </CardContent>
      </Card>

      {editing ? (
        <CategoryFormDialog
          mode="edit"
          category={category}
          existingCategories={existingCategories}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {deleting ? (
        <DeleteCategoryDialog category={category} onClose={() => setDeleting(false)} />
      ) : null}
      {merging ? (
        <MergeIntoDialog
          open
          onClose={() => setMerging(false)}
          kind="category"
          absorbId={category.id}
          absorbLabel={category.name}
        />
      ) : null}
    </>
  )
}

function CategoryFormDialog({
  mode,
  category,
  existingCategories,
  onClose,
}: {
  mode: 'create' | 'edit'
  category?: Pick<CategoryCard, 'id' | 'name' | 'itemCount'>
  existingCategories: Pick<CategoryCard, 'id' | 'name' | 'itemCount'>[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const have = new Set(existingCategories.map((row) => row.name.toLowerCase()))
  // Create: hide names already taken. Edit: keep every standard name so renaming
  // into an existing group can offer a merge.
  const presets =
    mode === 'edit'
      ? STANDARD_ITEM_CATEGORIES
      : STANDARD_ITEM_CATEGORIES.filter((name) => !have.has(name.toLowerCase()))

  const [source, setSource] = useState<string>(() => {
    if (mode === 'edit' && category) {
      const match = STANDARD_ITEM_CATEGORIES.find(
        (name) => name.toLowerCase() === category.name.toLowerCase(),
      )
      return match ?? CUSTOM
    }
    return presets[0] ?? CUSTOM
  })
  const [customName, setCustomName] = useState(() => {
    if (mode !== 'edit' || !category) return ''
    const isPreset = STANDARD_ITEM_CATEGORIES.some(
      (name) => name.toLowerCase() === category.name.toLowerCase(),
    )
    return isPreset ? '' : category.name
  })
  const [error, setError] = useState<string | null>(null)
  const [mergeInto, setMergeInto] = useState<Pick<CategoryCard, 'id' | 'name' | 'itemCount'> | null>(
    null,
  )

  const resolvedName = (source === CUSTOM ? customName : source).trim()

  const clashFor = (name: string) => {
    if (mode !== 'edit' || !category) return null
    const key = name.toLowerCase()
    if (key === category.name.toLowerCase()) return null
    return (
      existingCategories.find((row) => row.id !== category.id && row.name.toLowerCase() === key) ??
      null
    )
  }

  const save = () => {
    setError(null)
    if (!resolvedName) {
      setError('Category name is required.')
      return
    }

    // Offer merge before any server round-trip — do not wrap this in a transition
    // or the confirm dialog stays blocked behind a pending Save.
    if (mode === 'edit' && category) {
      const clash = clashFor(resolvedName)
      if (clash) {
        setMergeInto(clash)
        return
      }
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCategory({ name: resolvedName })
          : await updateCategory({ id: category!.id, name: resolvedName })

      if (result.ok) {
        toast.success(
          mode === 'create'
            ? `Category “${result.data.name}” added.`
            : `Category renamed to “${result.data.name}”.`,
        )
        onClose()
        router.refresh()
      } else if (
        mode === 'edit' &&
        category &&
        result.error.code === 'CONFLICT' &&
        result.error.details?.merge?.[0] === 'true' &&
        result.error.details.clashId?.[0]
      ) {
        setMergeInto({
          id: result.error.details.clashId[0],
          name: result.error.details.clashName?.[0] ?? resolvedName,
          itemCount: 0,
        })
      } else {
        setError(result.error.message)
      }
    })
  }

  if (mergeInto && category) {
    return (
      <MergeCategoryDialog
        absorb={category}
        keep={mergeInto}
        onBack={() => setMergeInto(null)}
        onDone={() => {
          setMergeInto(null)
          onClose()
        }}
      />
    )
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New category' : 'Edit category'}</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-muted-foreground">
          {mode === 'create'
            ? 'Pick a prepared merchandise group, or type your own name.'
            : 'Rename this group. If the name already belongs to another category, you can merge them.'}
        </p>

        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Field name="category-source" label="From list">
          <NativeSelect
            id="category-source"
            value={source}
            disabled={pending}
            onChange={(event) => setSource(event.target.value)}
          >
            {presets.map((name) => (
              <option key={name} value={name}>
                {name}
                {mode === 'edit' && clashFor(name) ? ' (merge)' : ''}
              </option>
            ))}
            <option value={CUSTOM}>Custom name…</option>
          </NativeSelect>
        </Field>

        {source === CUSTOM ? (
          <Field name="category-name" label="Category name" className="mt-3">
            <Input
              id="category-name"
              value={customName}
              disabled={pending}
              autoFocus
              placeholder="e.g. Spare parts"
              onChange={(event) => setCustomName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  save()
                }
              }}
            />
          </Field>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || !resolvedName} onClick={save}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {mode === 'create' ? 'Create' : clashFor(resolvedName) ? 'Merge…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MergeCategoryDialog({
  absorb,
  keep,
  onBack,
  onDone,
}: {
  absorb: Pick<CategoryCard, 'id' | 'name' | 'itemCount'>
  keep: Pick<CategoryCard, 'id' | 'name' | 'itemCount'>
  onBack: () => void
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const itemNote =
    absorb.itemCount > 0
      ? `${absorb.itemCount} item${absorb.itemCount === 1 ? '' : 's'} move into “${keep.name}”.`
      : `“${absorb.name}” has no items; it will still be removed.`

  const run = () =>
    startTransition(async () => {
      setError(null)
      const result = await mergeCategories({ keepId: keep.id, absorbId: absorb.id })
      if (result.ok) {
        toast.success(
          `Merged “${result.data.absorbedName}” into “${result.data.keepName}”.`,
        )
        onDone()
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onBack() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Merge categories?</DialogTitle>
        </DialogHeader>

        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          “{keep.name}” already exists. Merge “{absorb.name}” into “{keep.name}”?
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{itemNote}</li>
          <li>Transactions stay on those items — they just sit under “{keep.name}”.</li>
          <li>“{absorb.name}” is removed after the merge.</li>
        </ul>

        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onBack} disabled={pending}>
            Back
          </Button>
          <Button disabled={pending} onClick={run}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Merge into “{keep.name}”
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCategoryDialog({
  category,
  onClose,
}: {
  category: CategoryCard
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = () =>
    startTransition(async () => {
      setError(null)
      const result = await deleteCategory({ id: category.id })
      if (result.ok) {
        toast.success(`Category “${result.data.name}” deleted.`)
        onClose()
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete {category.name}</DialogTitle>
        </DialogHeader>

        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Only empty categories can be deleted. Items stay in the catalogue under their
          own names; this removes the group label only.
        </p>

        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={run}>
            {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
