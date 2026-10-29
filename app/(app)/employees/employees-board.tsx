'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createEmployee } from './actions'

type Row = {
  id: string
  name: string
  jobTitle: string | null
  department: string | null
  photoUrl: string | null
  workEmail: string | null
  workPhone: string | null
  mobile: string | null
  employmentType: string
  managerName: string | null
  active: boolean
  userName: string | null
}

type Linkable = { id: string; name: string; email: string }
type Manager = { id: string; name: string; jobTitle: string | null }

const TYPE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Employee',
  CONTRACTOR: 'Contractor',
  INTERN: 'Intern',
}

export function EmployeesBoard({
  rows,
  linkableUsers,
  managers,
  query,
  archived,
  canCreate,
}: {
  rows: Row[]
  linkableUsers: Linkable[]
  managers: Manager[]
  query: string
  archived: boolean
  canCreate: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState(query)
  const [open, setOpen] = useState(false)
  const [busy, startBusy] = useTransition()
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [workPhone, setWorkPhone] = useState('')
  const [employmentType, setEmploymentType] = useState('EMPLOYEE')
  const [managerId, setManagerId] = useState('')
  const [userId, setUserId] = useState('')

  function search() {
    const base = archived ? '/employees?archived=1' : '/employees'
    const next = q.trim()
    router.push(next ? `${base}${archived ? '&' : '?'}q=${encodeURIComponent(next)}` : base)
  }

  function create() {
    startBusy(async () => {
      const result = await createEmployee({
        name: name.trim() || 'Untitled',
        jobTitle: jobTitle.trim() || null,
        department: department.trim() || null,
        photoUrl: null,
        workEmail: workEmail.trim() || null,
        workPhone: workPhone.trim() || null,
        mobile: null,
        workStreet: null,
        workCity: null,
        workCountry: null,
        privateStreet: null,
        privateCity: null,
        privateCountry: null,
        emergencyContact: null,
        emergencyPhone: null,
        skills: null,
        notes: null,
        employmentType: employmentType as 'EMPLOYEE' | 'CONTRACTOR' | 'INTERN',
        hiredAt: null,
        leftAt: null,
        managerId: managerId || null,
        userId: userId || null,
        wageType: 'MONTHLY',
        wageAmount: '0',
        expenseAccountId: null,
        payableAccountId: null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not add employee')
        return
      }
      toast.success('Employee added')
      setOpen(false)
      setName('')
      setJobTitle('')
      setDepartment('')
      setWorkEmail('')
      setWorkPhone('')
      setEmploymentType('EMPLOYEE')
      setManagerId('')
      setUserId('')
      router.push(`/employees/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="employee-search" className="sr-only">
            Search
          </Label>
          <Input
            id="employee-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                search()
              }
            }}
            placeholder="Search name, job, department, skills…"
          />
        </div>
        <Button type="button" variant="outline" onClick={search}>
          Search
        </Button>
        {canCreate && !archived ? (
          <Button type="button" onClick={() => setOpen((value) => !value)}>
            {open ? 'Cancel' : 'New employee'}
          </Button>
        ) : null}
      </div>

      {open && canCreate ? (
        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Job title">
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Cashier" />
          </Field>
          <Field label="Department">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Store" />
          </Field>
          <Field label="Employment type">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="INTERN">Intern</option>
            </select>
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
          <Field label="Work phone">
            <Input value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} />
          </Field>
          <Field label="Manager">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">None</option>
              {managers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.jobTitle ? ` · ${row.jobTitle}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link login user (optional)">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">None</option>
              {linkableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !name.trim()} onClick={create}>
              {busy ? 'Saving…' : 'Add employee'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Job title</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Manager</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {archived ? 'No archived employees.' : 'No employees yet. Add the first person above.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={row.name} photoUrl={row.photoUrl} />
                      <div>
                        <Link href={`/employees/${row.id}`} className="font-medium text-primary hover:underline">
                          {row.name}
                        </Link>
                        {row.userName ? (
                          <div className="text-xs text-muted-foreground">Login: {row.userName}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.jobTitle ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.department ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.managerName ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{TYPE_LABEL[row.employmentType] ?? row.employmentType}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.workPhone || row.mobile || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.workEmail ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    )
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {initial}
    </span>
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
