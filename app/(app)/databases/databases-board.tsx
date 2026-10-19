'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  CheckIcon,
  DownloadIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { MAX_SUB_COMPANIES, type CompanyGroupKind } from '@/lib/company-group'
import type { ModuleFlag } from '@/lib/feature-flags'

import { attachSubCompany, createCompany, deleteCompany, openCompany } from './actions'
import {
  allModulesOn,
  CompanyAppsPicker,
  hasAnyModuleOn,
  moduleActionFields,
} from './company-apps-picker'
import { DatabaseLimitsPanel } from './database-limits-panel'
import { NoCompanyOpen } from './no-company-open'

export type DatabaseListRow = {
  id: string
  name: string
  legalName: string | null
  baseCurrency: string
  role: string
  ownerName: string | null
  isCurrent: boolean
  updatedAt: string
  sizeBytes: number
  parentOrgId: string | null
  parentName: string | null
  childCount: number
  groupKind: CompanyGroupKind
  accessRestricted: boolean
  rentExpiresAt: string | null
  maxUsers: number | null
  rentNote: string | null
  rentExpired: boolean
  openBlocked: boolean
  activeUsers: number
  modules: Record<ModuleFlag, boolean>
}

type Inspected = {
  key: string
  sourceLabel: string
  organizationId: string
  name: string
  legalName: string | null
  baseCurrency: string
  takenAt: string | null
  status: 'present' | 'missing'
  matchedOrgId: string | null
  matchedName: string | null
}

/**
 * Databases list + create/import panels. Panels stay on this page until the
 * user closes them — never navigates away while import is in progress.
 */
export function DatabasesBoard({
  databases,
  isSystemOwner,
  canConnect,
  initialPanel = null,
}: {
  databases: DatabaseListRow[]
  isSystemOwner: boolean
  canConnect: boolean
  /** Open create or import from a deep link (?create=1 / ?import=1). */
  initialPanel?: 'create' | 'import' | null
}) {
  const router = useRouter()
  const { update } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [panelOpen, setPanelOpen] = useState(initialPanel === 'import')
  const [createOpen, setCreateOpen] = useState(initialPanel === 'create')
  const [deleteTarget, setDeleteTarget] = useState<DatabaseListRow | null>(null)
  const [limitsTarget, setLimitsTarget] = useState<DatabaseListRow | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Inspected | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState('USD')
  const [newParentOrgId, setNewParentOrgId] = useState('')
  const [newModules, setNewModules] = useState(allModulesOn)
  const [attachOrgId, setAttachOrgId] = useState('')
  const [attachParentOrgId, setAttachParentOrgId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [inspected, setInspected] = useState<Inspected[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [editList, setEditList] = useState(false)
  const [, startTransition] = useTransition()

  const mainCandidates = databases.filter(
    (row) => !row.parentOrgId && row.childCount < MAX_SUB_COMPANIES,
  )
  const attachCandidates = databases.filter(
    (row) => !row.parentOrgId && row.childCount === 0 && row.groupKind !== 'main',
  )

  const openPanel = () => {
    setCreateOpen(false)
    setDeleteTarget(null)
    setLimitsTarget(null)
    setRestoreTarget(null)
    setPanelOpen(true)
    setInspected(null)
    setSelected(new Set())
    setFiles([])
  }

  const openCreate = () => {
    setPanelOpen(false)
    setDeleteTarget(null)
    setLimitsTarget(null)
    setRestoreTarget(null)
    setCreateOpen(true)
    setNewName('')
    setNewCurrency('USD')
    setNewParentOrgId('')
    setAttachOrgId('')
    setAttachParentOrgId('')
  }

  const openDelete = (db: DatabaseListRow) => {
    setPanelOpen(false)
    setCreateOpen(false)
    setLimitsTarget(null)
    setRestoreTarget(null)
    setDeleteTarget(db)
    setConfirmName('')
  }

  const openLimits = (db: DatabaseListRow) => {
    setPanelOpen(false)
    setCreateOpen(false)
    setDeleteTarget(null)
    setRestoreTarget(null)
    setLimitsTarget(db)
  }

  const openRestore = (row: Inspected) => {
    if (!row.matchedOrgId) return
    setCreateOpen(false)
    setDeleteTarget(null)
    setLimitsTarget(null)
    setRestoreTarget(row)
    setConfirmName('')
  }

  const closePanel = () => {
    if (busy) return
    setPanelOpen(false)
    setInspected(null)
    setSelected(new Set())
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const closeCreate = () => {
    if (busy) return
    setCreateOpen(false)
    setNewModules(allModulesOn())
  }

  const closeDelete = () => {
    if (busy) return
    setDeleteTarget(null)
    setConfirmName('')
  }

  const closeRestore = () => {
    if (busy) return
    setRestoreTarget(null)
    setConfirmName('')
  }

  const runCreate = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a company name.')
      return
    }
    if (!hasAnyModuleOn(newModules)) {
      toast.error('Leave at least one app on for this company.')
      return
    }
    setBusy(true)
    try {
      const result = await createCompany({
        name,
        baseCurrency: newCurrency || 'USD',
        fiscalYearStartMonth: 1,
        seedChart: true,
        parentOrgId: newParentOrgId || null,
        ...moduleActionFields(newModules),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(
        newParentOrgId
          ? `${result.data.name} created as a sub-company.`
          : `${result.data.name} created.`,
      )
      setCreateOpen(false)
      setNewModules(allModulesOn())
      startTransition(() => router.refresh())
      // Open the new company right away.
      await update({ orgId: result.data.id })
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('Could not create the company.')
    } finally {
      setBusy(false)
    }
  }

  const runAttach = async () => {
    if (!attachOrgId || !attachParentOrgId) {
      toast.error('Choose the company and its main company.')
      return
    }
    setBusy(true)
    try {
      const result = await attachSubCompany({
        orgId: attachOrgId,
        parentOrgId: attachParentOrgId,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${result.data.name} is now under ${result.data.parentName}.`)
      setAttachOrgId('')
      setAttachParentOrgId('')
      startTransition(() => router.refresh())
    } catch {
      toast.error('Could not attach that company.')
    } finally {
      setBusy(false)
    }
  }

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const next = [...list]
    setFiles(next)
    setBusy(true)
    try {
      const body = new FormData()
      for (const file of next) body.append('files', file)
      const res = await fetch('/api/backup/inspect', { method: 'POST', body })
      const data = (await res.json()) as { companies?: Inspected[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not read the backup.')
      const companies = data.companies ?? []
      setInspected(companies)
      setSelected(new Set(companies.filter((c) => c.status === 'missing').map((c) => c.key)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the backup.')
      setInspected(null)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string, status: 'present' | 'missing') => {
    if (status === 'present') return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const runImport = async () => {
    if (!files.length || selected.size === 0) return
    setBusy(true)
    try {
      const body = new FormData()
      for (const file of files) body.append('files', file)
      body.set('keys', JSON.stringify([...selected]))
      const res = await fetch('/api/backup/import', { method: 'POST', body })
      const data = (await res.json()) as {
        imported?: { key: string; orgId: string; name: string }[]
        skipped?: string[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not import.')
      const count = data.imported?.length ?? 0
      toast.success(
        count === 1
          ? `Imported ${data.imported![0].name}.`
          : `Imported ${count} databases.`,
      )
      // Refresh list; keep panel open so the user can see present/missing update.
      startTransition(() => router.refresh())
      // Re-inspect the same files so statuses flip to “present”.
      const again = new FormData()
      for (const file of files) again.append('files', file)
      const inspectRes = await fetch('/api/backup/inspect', { method: 'POST', body: again })
      const inspectData = (await inspectRes.json()) as { companies?: Inspected[] }
      if (inspectRes.ok) {
        setInspected(inspectData.companies ?? [])
        setSelected(new Set())
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import.')
    } finally {
      setBusy(false)
    }
  }

  const openDatabase = async (orgId: string, isCurrent: boolean) => {
    if (isCurrent) {
      router.push('/dashboard')
      return
    }
    setOpeningId(orgId)
    try {
      const allowed = await openCompany({ orgId })
      if (!allowed.ok) {
        toast.error(allowed.error.message)
        return
      }
      await update({ orgId })
      router.refresh()
      router.push('/dashboard')
    } catch {
      toast.error('Could not open that database.')
    } finally {
      setOpeningId(null)
    }
  }

  const runDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const result = await deleteCompany({
        orgId: deleteTarget.id,
        confirmName,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${result.data.deletedName} deleted.`)
      setDeleteTarget(null)
      setConfirmName('')
      if (result.data.switchToOrgId) {
        await update({ orgId: result.data.switchToOrgId })
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('Could not delete that company.')
    } finally {
      setBusy(false)
    }
  }

  const runRestore = async () => {
    if (!restoreTarget?.matchedOrgId || !files.length) return
    const companyName = restoreTarget.matchedName || restoreTarget.name
    setBusy(true)
    try {
      const file =
        files.find((entry) => restoreTarget.key.startsWith(`${entry.name}::`)) ?? files[0]
      const body = new FormData()
      body.set('file', file)
      body.set('key', restoreTarget.key)
      body.set('targetOrgId', restoreTarget.matchedOrgId)
      body.set('confirmName', confirmName)
      const res = await fetch('/api/backup/restore', { method: 'POST', body })
      const data = (await res.json()) as { name?: string; takenAt?: string | null; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not restore.')
      toast.success(
        data.takenAt
          ? `${data.name ?? companyName} restored to ${new Date(data.takenAt).toLocaleString()}.`
          : `${data.name ?? companyName} restored from backup.`,
      )
      setRestoreTarget(null)
      setConfirmName('')
      setPanelOpen(false)
      setInspected(null)
      setSelected(new Set())
      setFiles([])
      startTransition(() => router.refresh())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore.')
    } finally {
      setBusy(false)
    }
  }

  const missingCount = inspected?.filter((c) => c.status === 'missing').length ?? 0
  const presentCount = inspected?.filter((c) => c.status === 'present').length ?? 0
  // Company database delete is disabled — Trash soft-delete + Clear Trash purge instead.
  const canDeleteAny = false
  const showPicker =
    !createOpen && !panelOpen && !deleteTarget && !restoreTarget && !limitsTarget

  return (
    <div className="space-y-6">
      {showPicker ? (
        <NoCompanyOpen
          databases={databases}
          busyId={openingId}
          canConnect={canConnect}
          canCreate={isSystemOwner}
          canDelete={canDeleteAny}
          canManageLimits={isSystemOwner}
          editList={editList}
          onEditListChange={setEditList}
          onOpen={(orgId, isCurrent) => {
            if (!isCurrent && !canConnect) return
            void openDatabase(orgId, isCurrent)
          }}
          onCreate={openCreate}
          onOpenOrRestore={openPanel}
          onDelete={(row) => {
            const full = databases.find((entry) => entry.id === row.id)
            if (full) openDelete(full)
          }}
          onLimits={(row) => {
            const full = databases.find((entry) => entry.id === row.id)
            if (full) openLimits(full)
          }}
        />
      ) : null}

      {isSystemOwner && databases.length > 1 && showPicker ? (
        <div className="flex justify-center pb-4">
          <a
            href="/api/backup?scope=all"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <DownloadIcon />
            Download all companies
          </a>
        </div>
      ) : null}

      {restoreTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-company-title"
          className="rounded-lg border border-amber-500/40 bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 id="restore-company-title" className="text-sm font-semibold">
                Restore {restoreTarget.matchedName || restoreTarget.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This replaces the company that is on the system now with the books from this backup
                {restoreTarget.takenAt
                  ? ` (${new Date(restoreTarget.takenAt).toLocaleString()})`
                  : ''}
                . Invoices, payments, journals, and stock from after that moment are removed. Work
                that was already in the backup comes back.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close restore"
              disabled={busy}
              onClick={closeRestore}
            >
              <XIcon />
            </Button>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="restore-confirm-name">
                Type{' '}
                <span className="font-medium text-foreground">
                  {restoreTarget.matchedName || restoreTarget.name}
                </span>{' '}
                to confirm
              </Label>
              <Input
                id="restore-confirm-name"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  busy ||
                  confirmName.trim().toLowerCase() !==
                    (restoreTarget.matchedName || restoreTarget.name).trim().toLowerCase()
                }
                onClick={runRestore}
              >
                {busy ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                Restore from backup
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={closeRestore}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {limitsTarget ? (
        <DatabaseLimitsPanel company={limitsTarget} onClose={() => setLimitsTarget(null)} />
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-company-title"
          className="rounded-lg border border-destructive/30 bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 id="delete-company-title" className="text-sm font-semibold">
                Delete {deleteTarget.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This removes the company and all of its books from this system. Download a Backup
                first if you may need it again — Import backup can recreate the company later
                (chart, customers, vendors, items, periods).
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close delete"
              disabled={busy}
              onClick={closeDelete}
            >
              <XIcon />
            </Button>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/backup?orgId=${encodeURIComponent(deleteTarget.id)}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                <DownloadIcon />
                Download backup now
              </a>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-company-name">
                Type <span className="font-medium text-foreground">{deleteTarget.name}</span> to
                confirm
              </Label>
              <Input
                id="confirm-company-name"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={
                  busy ||
                  confirmName.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()
                }
                onClick={runDelete}
              >
                {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                Delete permanently
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={closeDelete}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-company-title"
          className="rounded-lg border bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 id="create-company-title" className="text-sm font-semibold">
                Create company
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A new separate database — its own ledger, customers, and stock. Optionally nest
                under a main company (up to {MAX_SUB_COMPANIES} subs). You become the owner and
                choose which apps it may use.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close create"
              disabled={busy}
              onClick={closeCreate}
            >
              <XIcon />
            </Button>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. EMAAR BUILDING"
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-currency">Currency</Label>
                <Input
                  id="company-currency"
                  value={newCurrency}
                  onChange={(event) => setNewCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-parent">Main company (optional)</Label>
                <select
                  id="company-parent"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newParentOrgId}
                  onChange={(event) => setNewParentOrgId(event.target.value)}
                  disabled={busy || mainCandidates.length === 0}
                >
                  <option value="">None — standalone / new main</option>
                  {mainCandidates.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.childCount > 0
                        ? ` (${row.childCount}/${MAX_SUB_COMPANIES} subs)`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <CompanyAppsPicker
              modules={newModules}
              onChange={setNewModules}
              disabled={busy}
              hint="ERP grant for this company. Turn apps off to withhold them; you can add or remove apps later under Limits."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !newName.trim() || !hasAnyModuleOn(newModules)}
                onClick={runCreate}
              >
                {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                Create and open
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={closeCreate}>
                Close
              </Button>
            </div>

            {isSystemOwner && attachCandidates.length > 0 && mainCandidates.length > 0 ? (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium">Attach existing company</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Put a standalone company under a main (max {MAX_SUB_COMPANIES} subs).
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="attach-org">Company</Label>
                    <select
                      id="attach-org"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      value={attachOrgId}
                      onChange={(event) => setAttachOrgId(event.target.value)}
                      disabled={busy}
                    >
                      <option value="">Select…</option>
                      {attachCandidates
                        .filter((row) => row.id !== attachParentOrgId)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="attach-parent">Under main</Label>
                    <select
                      id="attach-parent"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      value={attachParentOrgId}
                      onChange={(event) => setAttachParentOrgId(event.target.value)}
                      disabled={busy}
                    >
                      <option value="">Select…</option>
                      {mainCandidates
                        .filter((row) => row.id !== attachOrgId)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !attachOrgId || !attachParentOrgId}
                  onClick={runAttach}
                >
                  Attach as sub-company
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {panelOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-import-title"
          className="rounded-lg border bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 id="backup-import-title" className="text-sm font-semibold">
                Import backup
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose one or more backup files. “Not on list” can be imported as a new company.
                “Already here” can be Restored — that replaces the live books with the backup
                (point in time).
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close import"
              disabled={busy}
              onClick={closePanel}
            >
              <XIcon />
            </Button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                multiple
                className="hidden"
                onChange={(event) => onPickFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy && !inspected ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                Choose backup files
              </Button>
              {files.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {files.length} file{files.length === 1 ? '' : 's'} selected
                </span>
              ) : null}
            </div>

            {inspected ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{presentCount} already here</span>
                  {' · '}
                  <span className="font-medium text-foreground">{missingCount} not on this list</span>
                </p>
                <ul className="divide-y rounded-md border">
                  {inspected.map((row) => {
                    const canImport = row.status === 'missing'
                    const checked = selected.has(row.key)
                    return (
                      <li
                        key={row.key}
                        className={cn(
                          'flex flex-wrap items-center gap-3 px-3 py-2.5',
                          row.status === 'present' && 'bg-muted/40',
                        )}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={!canImport || busy}
                            checked={canImport ? checked : false}
                            onChange={() => toggle(row.key, row.status)}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium">{row.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {row.sourceLabel}
                              {row.takenAt ? ` · ${new Date(row.takenAt).toLocaleString()}` : ''}
                              {' · '}
                              {row.baseCurrency}
                            </span>
                          </span>
                        </label>
                        {row.status === 'present' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-accent-foreground">
                            <CheckIcon className="size-3" />
                            Already here
                            {row.matchedName && row.matchedName !== row.name
                              ? ` (${row.matchedName})`
                              : ''}
                          </span>
                        ) : (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                            Not on list
                          </span>
                        )}
                        {row.status === 'present' && row.matchedOrgId ? (
                          <>
                            {isSystemOwner ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy}
                                onClick={() => openRestore(row)}
                              >
                                <RotateCcwIcon />
                                Restore
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || openingId === row.matchedOrgId}
                              onClick={() =>
                                openDatabase(
                                  row.matchedOrgId!,
                                  databases.some((d) => d.id === row.matchedOrgId && d.isCurrent),
                                )
                              }
                            >
                              Connect
                            </Button>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy || selected.size === 0}
                    onClick={runImport}
                  >
                    {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                    Import selected ({selected.size})
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={closePanel}>
                    Close
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Import (not on list) creates a new company with the full books from the backup.
                  Restore (already here) replaces that company&apos;s live data with the backup —
                  type the company name to confirm. Stores and till definitions are included;
                  open POS sessions/orders are not.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
