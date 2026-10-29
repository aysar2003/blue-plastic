'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAttendance, upsertAttendance } from './actions'

type Employee = { id: string; name: string }
type Row = {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string | null
  checkOut: string | null
  workedHours: string | null
  note: string | null
  source?: string
}

export function AttendanceBoard({
  rows,
  employees,
  from,
  to,
  canManage,
}: {
  rows: Row[]
  employees: Employee[]
  from: string
  to: string
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(to)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [rangeFrom, setRangeFrom] = useState(from)
  const [rangeTo, setRangeTo] = useState(to)

  function filter() {
    router.push(
      `/employees/attendance?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
    )
  }

  function save() {
    startBusy(async () => {
      const result = await upsertAttendance({
        employeeId,
        date,
        checkIn: checkIn ? new Date(checkIn).toISOString() : null,
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
        workedHours: hours.trim() || null,
        note: note.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save')
        return
      }
      toast.success('Attendance saved')
      setNote('')
      router.refresh()
    })
  }

  function remove(id: string) {
    startBusy(async () => {
      const result = await deleteAttendance({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="From">
          <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
        </Field>
        <Button type="button" variant="outline" onClick={filter}>
          Filter
        </Button>
      </div>

      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <Field label="Employee">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Check in">
            <Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check out">
            <Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
          <Field label="Worked hours (optional)">
            <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="8" />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !employeeId || !date} onClick={save}>
              {busy ? 'Saving…' : 'Save day'}
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Hours</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No attendance in this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.employeeName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.workedHours ? Number(row.workedHours).toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.note ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage ? (
                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
