'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveType,
  decideLeaveRequest,
  upsertLeaveAllocation,
} from './actions'

type LeaveType = { id: string; name: string; paid: boolean; daysPerYear: string; active: boolean }
type Employee = { id: string; name: string }
type Allocation = {
  id: string
  employeeName: string
  leaveTypeName: string
  year: number
  entitledDays: string
}
type RequestRow = {
  id: string
  employeeName: string
  leaveTypeName: string
  dateFrom: string
  dateTo: string
  days: string
  status: string
  reason: string | null
}

export function LeaveBoard({
  types,
  employees,
  allocations,
  requests,
  year,
  canManage,
}: {
  types: LeaveType[]
  employees: Employee[]
  allocations: Allocation[]
  requests: RequestRow[]
  year: number
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [typeName, setTypeName] = useState('')
  const [typeDays, setTypeDays] = useState('21')
  const [typePaid, setTypePaid] = useState(true)

  const [allocEmployeeId, setAllocEmployeeId] = useState('')
  const [allocTypeId, setAllocTypeId] = useState('')
  const [allocDays, setAllocDays] = useState('21')

  const [reqEmployeeId, setReqEmployeeId] = useState('')
  const [reqTypeId, setReqTypeId] = useState('')
  const [reqFrom, setReqFrom] = useState('')
  const [reqTo, setReqTo] = useState('')
  const [reqReason, setReqReason] = useState('')

  function addType() {
    startBusy(async () => {
      const result = await createLeaveType({
        name: typeName.trim(),
        paid: typePaid,
        daysPerYear: typeDays || '0',
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create type')
        return
      }
      toast.success('Leave type added')
      setTypeName('')
      router.refresh()
    })
  }

  function saveAllocation() {
    startBusy(async () => {
      const result = await upsertLeaveAllocation({
        employeeId: allocEmployeeId,
        leaveTypeId: allocTypeId,
        year,
        entitledDays: allocDays || '0',
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save allocation')
        return
      }
      toast.success('Allocation saved')
      router.refresh()
    })
  }

  function submitRequest() {
    startBusy(async () => {
      const result = await createLeaveRequest({
        employeeId: reqEmployeeId,
        leaveTypeId: reqTypeId,
        dateFrom: reqFrom,
        dateTo: reqTo,
        reason: reqReason.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not submit')
        return
      }
      toast.success('Leave request submitted')
      setReqReason('')
      router.refresh()
    })
  }

  function decide(id: string, approve: boolean) {
    startBusy(async () => {
      const result = await decideLeaveRequest({ id, approve })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not decide')
        return
      }
      toast.success(approve ? 'Approved' : 'Refused')
      router.refresh()
    })
  }

  function cancel(id: string) {
    startBusy(async () => {
      const result = await cancelLeaveRequest({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not cancel')
        return
      }
      toast.success('Cancelled')
      router.refresh()
    })
  }

  const activeTypes = types.filter((t) => t.active)

  return (
    <div className="grid max-w-5xl gap-8">
      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Leave types</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Name">
              <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Annual leave" />
            </Field>
            <Field label="Days / year">
              <Input value={typeDays} onChange={(e) => setTypeDays(e.target.value)} />
            </Field>
            <Field label="Paid">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={typePaid ? 'yes' : 'no'}
                onChange={(e) => setTypePaid(e.target.value === 'yes')}
              >
                <option value="yes">Paid</option>
                <option value="no">Unpaid</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="button" disabled={busy || !typeName.trim()} onClick={addType}>
                Add type
              </Button>
            </div>
          </div>
          <ul className="text-sm text-muted-foreground">
            {types.map((t) => (
              <li key={t.id}>
                {t.name} · {t.daysPerYear} days · {t.paid ? 'paid' : 'unpaid'}
                {!t.active ? ' (archived)' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Allocations ({year})
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Employee">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={allocEmployeeId}
                onChange={(e) => setAllocEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={allocTypeId}
                onChange={(e) => setAllocTypeId(e.target.value)}
              >
                <option value="">Select…</option>
                {activeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entitled days">
              <Input value={allocDays} onChange={(e) => setAllocDays(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy || !allocEmployeeId || !allocTypeId}
                onClick={saveAllocation}
              >
                Save allocation
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Days</th>
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No allocations for {year}.
                    </td>
                  </tr>
                ) : (
                  allocations.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{row.employeeName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.leaveTypeName}</td>
                      <td className="px-3 py-2">{Number(row.entitledDays)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Requests</h2>
        {canManage ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={reqEmployeeId}
                onChange={(e) => setReqEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={reqTypeId}
                onChange={(e) => setReqTypeId(e.target.value)}
              >
                <option value="">Select…</option>
                {activeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <Input type="date" value={reqFrom} onChange={(e) => setReqFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={reqTo} onChange={(e) => setReqTo(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Reason">
                <Input value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
              </Field>
            </div>
            <div>
              <Button
                type="button"
                disabled={busy || !reqEmployeeId || !reqTypeId || !reqFrom || !reqTo}
                onClick={submitRequest}
              >
                Submit request
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No leave requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{row.employeeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.leaveTypeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.dateFrom} → {row.dateTo}
                    </td>
                    <td className="px-3 py-2">{Number(row.days)}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && row.status === 'PENDING' ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" size="sm" disabled={busy} onClick={() => decide(row.id, true)}>
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => decide(row.id, false)}
                          >
                            Refuse
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => cancel(row.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
