'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createAttendanceDevice,
  deleteAttendanceDevice,
  mapAttendanceDeviceUser,
  rotateAttendanceDeviceToken,
  unmapAttendanceDeviceUser,
  updateAttendanceDevice,
} from './actions'

type Device = {
  id: string
  name: string
  kind: string
  active: boolean
  externalKey: string
  lastSeenAt: string | null
  userCount: number
  punchCount: number
}
type Employee = { id: string; name: string }
type Mapping = {
  id: string
  deviceId: string
  employeeId: string
  employeeName: string
  externalUserId: string
}
type Punch = {
  id: string
  deviceName: string
  employeeName: string | null
  punchedAt: string
  kind: string
  externalUserId: string | null
}

export function DevicesBoard({
  devices,
  employees,
  mappings,
  punches,
  canManage,
}: {
  devices: Device[]
  employees: Employee[]
  mappings: Mapping[]
  punches: Punch[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('GENERIC_HTTP')
  const [externalKey, setExternalKey] = useState('')
  const [shownToken, setShownToken] = useState<string | null>(null)
  const [mapDeviceId, setMapDeviceId] = useState('')
  const [mapEmployeeId, setMapEmployeeId] = useState('')
  const [mapExternalUserId, setMapExternalUserId] = useState('')

  function create() {
    startBusy(async () => {
      const result = await createAttendanceDevice({
        name: name.trim(),
        kind: kind as 'GENERIC_HTTP' | 'ZKTECO' | 'ANVIZ' | 'OTHER',
        externalKey: externalKey.trim(),
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create')
        return
      }
      setShownToken(result.data?.token ?? null)
      toast.success('Device created — copy the token now')
      setName('')
      setExternalKey('')
      router.refresh()
    })
  }

  function toggleActive(device: Device) {
    startBusy(async () => {
      const result = await updateAttendanceDevice({
        id: device.id,
        name: device.name,
        kind: device.kind as 'GENERIC_HTTP' | 'ZKTECO' | 'ANVIZ' | 'OTHER',
        externalKey: device.externalKey,
        active: !device.active,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Update failed')
        return
      }
      router.refresh()
    })
  }

  function rotate(id: string) {
    if (!window.confirm('Rotate token? The old token stops working immediately.')) return
    startBusy(async () => {
      const result = await rotateAttendanceDeviceToken({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Rotate failed')
        return
      }
      setShownToken(result.data?.token ?? null)
      toast.success('New token ready — copy it now')
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this device and its punches?')) return
    startBusy(async () => {
      const result = await deleteAttendanceDevice({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Delete failed')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  function mapUser() {
    startBusy(async () => {
      const result = await mapAttendanceDeviceUser({
        deviceId: mapDeviceId,
        employeeId: mapEmployeeId,
        externalUserId: mapExternalUserId.trim(),
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Map failed')
        return
      }
      toast.success('Mapped')
      setMapExternalUserId('')
      router.refresh()
    })
  }

  function unmap(id: string) {
    startBusy(async () => {
      const result = await unmapAttendanceDeviceUser({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Unmap failed')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-8">
      {shownToken ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="font-medium">Device token (shown once)</div>
          <code className="mt-1 block break-all select-all">{shownToken}</code>
          <p className="mt-2 text-xs text-muted-foreground">
            POST /api/attendance/punches with Authorization: Bearer &lt;token&gt;
          </p>
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setShownToken(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Register device
          </h2>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Front door clock" />
          </Field>
          <Field label="Kind">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="GENERIC_HTTP">Generic HTTP</option>
              <option value="ZKTECO">ZKTeco</option>
              <option value="ANVIZ">Anviz</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="External key (serial / terminal id)">
            <Input value={externalKey} onChange={(e) => setExternalKey(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" disabled={busy || !name.trim() || !externalKey.trim()} onClick={create}>
              Add device
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Device</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Users</th>
              <th className="px-3 py-2 font-medium">Punches</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No devices yet. Register a Generic HTTP clock to push punches.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {d.name}
                    {!d.active ? <span className="ml-2 text-xs text-muted-foreground">inactive</span> : null}
                    {d.lastSeenAt ? (
                      <div className="text-xs text-muted-foreground">
                        Last seen {new Date(d.lastSeenAt).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{d.kind}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.externalKey}</td>
                  <td className="px-3 py-2">{d.userCount}</td>
                  <td className="px-3 py-2">{d.punchCount}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => toggleActive(d)}>
                          {d.active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => rotate(d.id)}>
                          Rotate token
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(d.id)}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Map device user → employee
          </h2>
          <Field label="Device">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={mapDeviceId}
              onChange={(e) => setMapDeviceId(e.target.value)}
            >
              <option value="">Select…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employee">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={mapEmployeeId}
              onChange={(e) => setMapEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Device user id (badge / PIN)">
            <Input value={mapExternalUserId} onChange={(e) => setMapExternalUserId(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={busy || !mapDeviceId || !mapEmployeeId || !mapExternalUserId.trim()}
              onClick={mapUser}
            >
              Save map
            </Button>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">User maps</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {mappings.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">No mappings yet.</li>
          ) : (
            mappings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{m.externalUserId}</span> → {m.employeeName}
                </span>
                {canManage ? (
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => unmap(m.id)}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Recent punches
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {punches.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">No punches yet.</li>
          ) : (
            punches.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <span className="font-medium">{p.employeeName ?? p.externalUserId ?? 'Unmapped'}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {p.kind} · {p.deviceName} · {new Date(p.punchedAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
