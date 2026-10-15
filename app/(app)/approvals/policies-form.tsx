'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { ApprovalEntityType } from '@prisma/client'

import { APPROVAL_ENTITY_TYPES, entityTypeLabel } from '@/lib/approval-labels'
import {
  createApprovalPolicy,
  deleteApprovalPolicy,
  updateApprovalPolicy,
} from './actions'

type PolicyRow = {
  id: string
  name: string
  entityType: ApprovalEntityType
  enabled: boolean
  minAmount: string
  maxAmount: string | null
  priority: number
  requireDifferentApprover: boolean
  levels: number
}

const ENTITY_OPTIONS = APPROVAL_ENTITY_TYPES

export function ApprovalPoliciesForm({ policies }: { policies: PolicyRow[] }) {
  const [pending, start] = useTransition()

  function create(formData: FormData) {
    start(async () => {
      const maxRaw = String(formData.get('maxAmount') ?? '').trim()
      const result = await createApprovalPolicy({
        name: String(formData.get('name') ?? ''),
        entityType: String(formData.get('entityType')) as ApprovalEntityType,
        enabled: true,
        minAmount: String(formData.get('minAmount') ?? '0'),
        maxAmount: maxRaw === '' ? null : maxRaw,
        priority: Number(formData.get('priority') ?? 100),
        requireDifferentApprover: formData.get('requireDifferentApprover') === 'true',
        levels: Number(formData.get('levels') ?? 1),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Workflow added.')
    })
  }

  function save(formData: FormData) {
    const id = String(formData.get('id'))
    start(async () => {
      const maxRaw = String(formData.get('maxAmount') ?? '').trim()
      const result = await updateApprovalPolicy({
        id,
        name: String(formData.get('name') ?? ''),
        enabled: formData.get('enabled') === 'true',
        minAmount: String(formData.get('minAmount') ?? '0'),
        maxAmount: maxRaw === '' ? null : maxRaw,
        priority: Number(formData.get('priority') ?? 100),
        requireDifferentApprover: formData.get('requireDifferentApprover') === 'true',
        levels: Number(formData.get('levels') ?? 1),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Workflow saved.')
    })
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`Delete workflow “${name}”?`)) return
    start(async () => {
      const result = await deleteApprovalPolicy({ id })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Workflow deleted.')
    })
  }

  return (
    <div className="space-y-6">
      <form
        action={create}
        className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Add workflow / rule</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Example: “Invoices over 5,000” with 2 levels. Lower priority number runs first.
            Leave max blank for no ceiling.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs sm:col-span-2 lg:col-span-1">
            <span className="text-muted-foreground">Name</span>
            <input
              name="name"
              required
              placeholder="e.g. Large invoices"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Document family</span>
            <select
              name="entityType"
              defaultValue="SALES_DOCUMENT"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {ENTITY_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {entityTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Priority (1 = first)</span>
            <input
              name="priority"
              type="number"
              min={1}
              defaultValue={100}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Min amount</span>
            <input
              name="minAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Max amount (optional)</span>
            <input
              name="maxAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="No limit"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Approval levels</span>
            <select
              name="levels"
              defaultValue={1}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value={1}>1 — maker-checker</option>
              <option value={2}>2 — escalate</option>
              <option value={3}>3 — board / owner</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="requireDifferentApprover"
            value="true"
            defaultChecked
            className="size-3.5 rounded border-input"
          />
          Different person must approve (SOX)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add workflow'}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Your workflows</p>
        {policies.map((policy) => (
          <form
            key={policy.id}
            action={save}
            className="space-y-3 rounded-lg border border-border bg-card p-3"
          >
            <input type="hidden" name="id" value={policy.id} />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <input
                  name="name"
                  required
                  defaultValue={policy.name}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {entityTypeLabel(policy.entityType)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="enabled"
                  value="true"
                  defaultChecked={policy.enabled}
                  className="size-3.5 rounded border-input"
                />
                On
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs">
                <span className="text-muted-foreground">Priority</span>
                <input
                  name="priority"
                  type="number"
                  min={1}
                  defaultValue={policy.priority}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Min</span>
                <input
                  name="minAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={policy.minAmount}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Max</span>
                <input
                  name="maxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={policy.maxAmount ?? ''}
                  placeholder="No limit"
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Levels</span>
                <select
                  name="levels"
                  defaultValue={policy.levels}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="requireDifferentApprover"
                  value="true"
                  defaultChecked={policy.requireDifferentApprover}
                  className="size-3.5 rounded border-input"
                />
                Different person
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(policy.id, policy.name)}
                  className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
