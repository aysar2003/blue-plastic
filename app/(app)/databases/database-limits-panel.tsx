'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, SaveIcon, ShieldIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ModuleFlag } from '@/lib/feature-flags'

import { updateCompanyLimits } from './actions'
import {
  CompanyAppsPicker,
  hasAnyModuleOn,
  moduleActionFields,
} from './company-apps-picker'
import type { DatabaseListRow } from './databases-board'

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DatabaseLimitsPanel({
  company,
  onClose,
}: {
  company: DatabaseListRow
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [accessRestricted, setAccessRestricted] = useState(company.accessRestricted)
  const [rentExpiresAt, setRentExpiresAt] = useState(toDateInput(company.rentExpiresAt))
  const [maxUsers, setMaxUsers] = useState(
    company.maxUsers != null ? String(company.maxUsers) : '',
  )
  const [rentNote, setRentNote] = useState(company.rentNote ?? '')
  const [modules, setModules] = useState<Record<ModuleFlag, boolean>>(() => ({
    ...company.modules,
  }))

  function save() {
    if (!hasAnyModuleOn(modules)) {
      toast.error('Leave at least one app on for this company.')
      return
    }
    startTransition(async () => {
      const result = await updateCompanyLimits({
        orgId: company.id,
        accessRestricted,
        rentExpiresAt: rentExpiresAt || null,
        maxUsers: maxUsers.trim() === '' ? null : Number(maxUsers),
        rentNote: rentNote.trim() || null,
        ...moduleActionFields(modules),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`Limits saved for ${result.data.name}.`)
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-limits-title"
      className="rounded-lg border border-border bg-card shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 id="company-limits-title" className="flex items-center gap-2 text-sm font-semibold">
            <ShieldIcon className="size-4 text-primary" />
            Limits · {company.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ERP system Limits: lock, rent, seats, and which apps this company may use. Add or remove
            apps anytime. Company tax on/off is Settings → Tax inside the company — not here.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close limits" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-input"
            checked={accessRestricted}
            onChange={(event) => setAccessRestricted(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium">Lock this database (xayiraad)</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Staff cannot open it until you clear the lock. You (system owner) can still open it.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rent-expires">Rent ends (time limit)</Label>
            <Input
              id="rent-expires"
              type="date"
              value={rentExpiresAt}
              onChange={(event) => setRentExpiresAt(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Blank = no end date. After this day staff cannot open the books.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max-users">Max users</Label>
            <Input
              id="max-users"
              type="number"
              min={0}
              max={500}
              placeholder="Unlimited"
              value={maxUsers}
              onChange={(event) => setMaxUsers(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Now {company.activeUsers} active. Blank = unlimited. Invites stop at the cap.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rent-note">Note (optional)</Label>
          <Input
            id="rent-note"
            value={rentNote}
            maxLength={200}
            placeholder="e.g. Plan monthly · invoice 104"
            onChange={(event) => setRentNote(event.target.value)}
          />
        </div>

        <CompanyAppsPicker
          modules={modules}
          onChange={setModules}
          disabled={pending}
          hint="Check to grant an app, uncheck to remove it from this company. At least one must stay on."
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending || !hasAnyModuleOn(modules)} onClick={save}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            Save limits
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
