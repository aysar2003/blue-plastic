'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ApprovalEntityType } from '@prisma/client'

import {
  APPROVAL_DOCUMENT_KINDS,
  APPROVAL_ENTITY_TYPES,
  documentKindLabel,
  entityTypeLabel,
} from '@/lib/approval-labels'
import {
  createApprovalPolicy,
  deleteApprovalPolicy,
  updateApprovalPolicy,
} from './actions'

type Member = { id: string; name: string; email: string; role: string }

type PolicyRow = {
  id: string
  name: string
  entityType: ApprovalEntityType
  documentKind: string | null
  enabled: boolean
  minAmount: string
  maxAmount: string | null
  priority: number
  requireDifferentApprover: boolean
  levels: number
  source: string
  approverIds: string[]
}

const ENTITY_OPTIONS = APPROVAL_ENTITY_TYPES

function readApproverIds(formData: FormData): string[] {
  return formData.getAll('approverIds').map((value) => String(value)).filter(Boolean)
}

function ApproverPicker({ members, selected }: { members: Member[]; selected: string[] }) {
  if (members.length === 0) {
    return <p className="text-xs text-muted-foreground">No company users to assign yet.</p>
  }
  return (
    <fieldset className="rounded-md border border-border p-2">
      <legend className="px-1 text-xs text-muted-foreground">Users who may approve</legend>
      <p className="mb-1.5 text-[0.6875rem] text-muted-foreground">
        Tick people to restrict this rule to them. Leave empty so anyone with Approve permission
        may decide. Owner and Admin can always decide.
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {members.map((member) => (
          <label key={member.id} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="approverIds"
              value={member.id}
              defaultChecked={selected.includes(member.id)}
              className="size-3.5 rounded border-input"
            />
            <span className="min-w-0 truncate">
              {member.name}
              <span className="ml-1 text-muted-foreground">{member.role.toLowerCase()}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ApprovalPoliciesForm({
  policies,
  members,
}: {
  policies: PolicyRow[]
  members: Member[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [createEntity, setCreateEntity] = useState<ApprovalEntityType>('SALES_DOCUMENT')
  const createKinds = APPROVAL_DOCUMENT_KINDS[createEntity] ?? []

  function create(formData: FormData) {
    start(async () => {
      const maxRaw = String(formData.get('maxAmount') ?? '').trim()
      const kindRaw = String(formData.get('documentKind') ?? '').trim()
      const result = await createApprovalPolicy({
        name: String(formData.get('name') ?? ''),
        entityType: String(formData.get('entityType')) as ApprovalEntityType,
        documentKind: kindRaw === '' ? null : kindRaw,
        enabled: true,
        minAmount: String(formData.get('minAmount') ?? '0'),
        maxAmount: maxRaw === '' ? null : maxRaw,
        priority: Number(formData.get('priority') ?? 100),
        requireDifferentApprover: formData.get('requireDifferentApprover') === 'true',
        levels: Number(formData.get('levels') ?? 1),
        approverUserIds: readApproverIds(formData),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Workflow added.')
      router.refresh()
    })
  }

  function save(formData: FormData) {
    const id = String(formData.get('id'))
    start(async () => {
      const maxRaw = String(formData.get('maxAmount') ?? '').trim()
      const kindRaw = String(formData.get('documentKind') ?? '').trim()
      const result = await updateApprovalPolicy({
        id,
        name: String(formData.get('name') ?? ''),
        documentKind: kindRaw === '' ? null : kindRaw,
        enabled: formData.get('enabled') === 'true',
        minAmount: String(formData.get('minAmount') ?? '0'),
        maxAmount: maxRaw === '' ? null : maxRaw,
        priority: Number(formData.get('priority') ?? 100),
        requireDifferentApprover: formData.get('requireDifferentApprover') === 'true',
        levels: Number(formData.get('levels') ?? 1),
        approverUserIds: readApproverIds(formData),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Workflow saved.')
      router.refresh()
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
      router.refresh()
    })
  }

  const byFamily = ENTITY_OPTIONS.map((type) => ({
    type,
    rows: policies.filter((policy) => policy.entityType === type),
  })).filter((group) => group.rows.length > 0)

  return (
    <div className="space-y-6">
      <form
        action={create}
        className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Build your own rule</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Example: “Sales orders only”, or “Invoices over 5,000” with 2 levels. Lower priority
            number runs first. Leave max blank for no ceiling.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs sm:col-span-2 lg:col-span-1">
            <span className="text-muted-foreground">Name</span>
            <input
              name="name"
              required
              placeholder="e.g. Sales orders"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Family</span>
            <select
              name="entityType"
              value={createEntity}
              onChange={(event) => setCreateEntity(event.target.value as ApprovalEntityType)}
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
            <span className="text-muted-foreground">Kind (optional)</span>
            <select
              name="documentKind"
              defaultValue=""
              key={createEntity}
              disabled={createKinds.length === 0}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60"
            >
              <option value="">All in this family</option>
              {createKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
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
              defaultValue={50}
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
          Different person must approve
        </label>
        <ApproverPicker members={members} selected={[]} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add this rule'}
        </button>
      </form>

      <div className="space-y-6">
        <p className="text-sm font-semibold">Your workflows</p>
        {byFamily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet. Use a ready-made set above, or add one here.</p>
        ) : null}
        {byFamily.map((group) => (
          <div key={group.type} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {entityTypeLabel(group.type)}
            </h3>
            {group.rows.map((policy) => {
              const kinds = APPROVAL_DOCUMENT_KINDS[policy.entityType] ?? []
              return (
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
                        {documentKindLabel(policy.entityType, policy.documentKind)}
                        {policy.source === 'READY' ? ' · ready-made' : ' · custom'}
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
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {kinds.length > 0 ? (
                      <label className="block text-xs sm:col-span-2 lg:col-span-1">
                        <span className="text-muted-foreground">Kind</span>
                        <select
                          name="documentKind"
                          defaultValue={policy.documentKind ?? ''}
                          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="">All in this family</option>
                          {kinds.map((kind) => (
                            <option key={kind.value} value={kind.value}>
                              {kind.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <input type="hidden" name="documentKind" value="" />
                    )}
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
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      name="requireDifferentApprover"
                      value="true"
                      defaultChecked={policy.requireDifferentApprover}
                      className="size-3.5 rounded border-input"
                    />
                    Different person must approve
                  </label>
                  <ApproverPicker members={members} selected={policy.approverIds} />
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
                </form>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
