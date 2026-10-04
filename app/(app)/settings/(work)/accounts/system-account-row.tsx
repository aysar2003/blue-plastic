'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { EntityPicker } from '@/components/forms/entity-picker'
import { Button } from '@/components/ui/button'
import type { SystemAccountBinding } from '@/server/services/system-accounts.service'
import { assignSystemAccount } from './actions'

/**
 * One role, and the account it posts to.
 *
 * The warning about existing entries is the point of the component. Rebinding a
 * role does not move a balance — postings stay where they were made — so an
 * account with history left behind is a real consequence, stated before the
 * change rather than discovered after it.
 */
export function SystemAccountRow({
  binding,
  canEdit,
}: {
  binding: SystemAccountBinding
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string | null>(binding.account?.id ?? null)

  const dirty = selected !== null && selected !== (binding.account?.id ?? null)
  const hasHistory = binding.entries > 0

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[1fr_20rem] sm:items-start">
      <div className="min-w-0">
        <p className="text-sm font-medium">{binding.role.label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{binding.role.used}</p>
        {binding.account ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Currently <span className="tabular">{binding.account.code}</span> {binding.account.name}
            {hasHistory ? (
              <>
                {' · '}
                <span className="tabular">{binding.entries}</span>{' '}
                {binding.entries === 1 ? 'entry' : 'entries'} posted
              </>
            ) : (
              ' · nothing posted yet'
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs text-destructive">
            Not set. The system cannot post anything that needs this role.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <EntityPicker
          options={binding.candidates.map((account) => ({
            id: account.id,
            label: account.name,
            hint: account.code,
          }))}
          value={selected}
          onChange={setSelected}
          disabled={!canEdit || pending}
          placeholder="Search accounts"
          emptyMessage="No account of the right type. Add one in the chart of accounts."
        />

        {dirty ? (
          <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs">
            {hasHistory ? (
              <p className="flex gap-1.5 text-muted-foreground">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>
                  The {binding.entries} {binding.entries === 1 ? 'entry' : 'entries'} already posted stay on{' '}
                  {binding.account?.code}. Only new postings go to the account you choose.
                </span>
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await assignSystemAccount({ key: binding.role.key, accountId: selected })
                    if (result.ok) {
                      toast.success(`${binding.role.label} updated.`)
                      router.refresh()
                    } else {
                      toast.error(result.error.message)
                      setSelected(binding.account?.id ?? null)
                    }
                  })
                }
              >
                {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setSelected(binding.account?.id ?? null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
