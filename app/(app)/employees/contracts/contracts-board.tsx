'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createEmployeeContract,
  deleteEmployeeContract,
  setEmployeeContractState,
  uploadEmployeeContractFile,
} from './actions'

type Employee = { id: string; name: string }
type Contract = {
  id: string
  employeeId: string
  employeeName: string
  name: string
  state: string
  dateStart: string
  dateEnd: string | null
  wageType: string
  wageAmount: string
  jobTitle: string | null
  hasFile: boolean
  originalName: string | null
}

export function ContractsBoard({
  contracts,
  employees,
  canManage,
}: {
  contracts: Contract[]
  employees: Employee[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('Employment contract')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [wageType, setWageType] = useState('MONTHLY')
  const [wageAmount, setWageAmount] = useState('0')
  const [jobTitle, setJobTitle] = useState('')

  function create() {
    startBusy(async () => {
      const result = await createEmployeeContract({
        employeeId,
        name: name.trim() || 'Employment contract',
        dateStart,
        dateEnd: dateEnd || null,
        wageType: wageType as 'MONTHLY' | 'DAILY' | 'HOURLY',
        wageAmount: wageAmount || '0',
        jobTitle: jobTitle.trim() || null,
        state: 'DRAFT',
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create')
        return
      }
      toast.success('Contract created')
      router.refresh()
    })
  }

  function openContract(id: string) {
    startBusy(async () => {
      const result = await setEmployeeContractState({ id, state: 'OPEN', syncWage: true })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not open')
        return
      }
      toast.success('Contract opened — wage synced to employee')
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this contract?')) return
    startBusy(async () => {
      const result = await deleteEmployeeContract({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  function upload(id: string, file: File | null) {
    if (!file) return
    startBusy(async () => {
      const form = new FormData()
      form.set('id', id)
      form.set('file', file)
      const result = await uploadEmployeeContractFile(form)
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Upload failed')
        return
      }
      toast.success('Contract file saved')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
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
          <Field label="Contract name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Start">
            <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </Field>
          <Field label="End (optional)">
            <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </Field>
          <Field label="Wage type">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={wageType}
              onChange={(e) => setWageType(e.target.value)}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="DAILY">Daily</option>
              <option value="HOURLY">Hourly</option>
            </select>
          </Field>
          <Field label="Wage amount">
            <Input value={wageAmount} onChange={(e) => setWageAmount(e.target.value)} />
          </Field>
          <Field label="Job title">
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" disabled={busy || !employeeId || !dateStart} onClick={create}>
              Add contract
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Contract</th>
              <th className="px-3 py-2 font-medium">Dates</th>
              <th className="px-3 py-2 font-medium">Wage</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No contracts yet. Add the first employment agreement above.
                </td>
              </tr>
            ) : (
              contracts.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2">
                    <Link href={`/employees/${row.employeeId}`} className="text-primary hover:underline">
                      {row.employeeName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {row.name}
                    {row.jobTitle ? (
                      <div className="text-xs text-muted-foreground">{row.jobTitle}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.dateStart}
                    {row.dateEnd ? ` → ${row.dateEnd}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    {Number(row.wageAmount).toFixed(2)} /{' '}
                    {row.wageType === 'DAILY' ? 'day' : row.wageType === 'HOURLY' ? 'hour' : 'month'}
                  </td>
                  <td className="px-3 py-2">{row.state}</td>
                  <td className="px-3 py-2">
                    {row.hasFile ? (
                      <a
                        className="text-primary hover:underline"
                        href={`/api/employees/${row.employeeId}/contracts/${row.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.originalName ?? 'Open'}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {canManage ? (
                      <div className="mt-1">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="max-w-[12rem] text-xs"
                          onChange={(e) => upload(row.id, e.target.files?.[0] ?? null)}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage && row.state === 'DRAFT' ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button type="button" size="sm" disabled={busy} onClick={() => openContract(row.id)}>
                          Open + sync wage
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
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
