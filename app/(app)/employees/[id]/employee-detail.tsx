'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/date'
import { deleteEmployee, setEmployeeActive, updateEmployee } from '../actions'

type WageChange = {
  at: string
  actorName: string
  fromType: string
  toType: string
  fromAmount: string
  toAmount: string
  note: string | null
}

type Employee = {
  id: string
  name: string
  jobTitle: string | null
  department: string | null
  photoUrl: string | null
  workEmail: string | null
  workPhone: string | null
  mobile: string | null
  workStreet: string | null
  workCity: string | null
  workCountry: string | null
  privateStreet: string | null
  privateCity: string | null
  privateCountry: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  skills: string | null
  notes: string | null
  employmentType: 'EMPLOYEE' | 'CONTRACTOR' | 'INTERN'
  hiredAt: string | null
  leftAt: string | null
  managerId: string | null
  userId: string | null
  wageType: 'MONTHLY' | 'DAILY' | 'HOURLY'
  wageAmount: string
  expenseAccountId: string | null
  payableAccountId: string | null
  active: boolean
}

type Linkable = { id: string; name: string; email: string }
type Manager = { id: string; name: string; jobTitle: string | null }
type Account = { id: string; label: string }

export function EmployeeDetail({
  employee,
  linkableUsers,
  managers,
  accounts,
  canUpdate,
  canDelete,
  wageChanges = [],
  timeZone = 'UTC',
}: {
  employee: Employee
  linkableUsers: Linkable[]
  managers: Manager[]
  accounts: Account[]
  canUpdate: boolean
  canDelete: boolean
  wageChanges?: WageChange[]
  timeZone?: string
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [name, setName] = useState(employee.name)
  const [jobTitle, setJobTitle] = useState(employee.jobTitle ?? '')
  const [department, setDepartment] = useState(employee.department ?? '')
  const [photoUrl, setPhotoUrl] = useState(employee.photoUrl ?? '')
  const [workEmail, setWorkEmail] = useState(employee.workEmail ?? '')
  const [workPhone, setWorkPhone] = useState(employee.workPhone ?? '')
  const [mobile, setMobile] = useState(employee.mobile ?? '')
  const [workStreet, setWorkStreet] = useState(employee.workStreet ?? '')
  const [workCity, setWorkCity] = useState(employee.workCity ?? '')
  const [workCountry, setWorkCountry] = useState(employee.workCountry ?? '')
  const [privateStreet, setPrivateStreet] = useState(employee.privateStreet ?? '')
  const [privateCity, setPrivateCity] = useState(employee.privateCity ?? '')
  const [privateCountry, setPrivateCountry] = useState(employee.privateCountry ?? '')
  const [emergencyContact, setEmergencyContact] = useState(employee.emergencyContact ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(employee.emergencyPhone ?? '')
  const [skills, setSkills] = useState(employee.skills ?? '')
  const [notes, setNotes] = useState(employee.notes ?? '')
  const [employmentType, setEmploymentType] = useState(employee.employmentType)
  const [hiredAt, setHiredAt] = useState(employee.hiredAt ?? '')
  const [leftAt, setLeftAt] = useState(employee.leftAt ?? '')
  const [managerId, setManagerId] = useState(employee.managerId ?? '')
  const [userId, setUserId] = useState(employee.userId ?? '')
  const [wageType, setWageType] = useState(employee.wageType)
  const [wageAmount, setWageAmount] = useState(employee.wageAmount)
  const [wageRaiseNote, setWageRaiseNote] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState(employee.expenseAccountId ?? '')
  const [payableAccountId, setPayableAccountId] = useState(employee.payableAccountId ?? '')

  const wageChanged = useMemo(() => {
    const amount = wageAmount.trim() || '0'
    const prev = Number(employee.wageAmount)
    const next = Number(amount)
    return (
      wageType !== employee.wageType ||
      (Number.isFinite(prev) && Number.isFinite(next) ? prev !== next : amount !== employee.wageAmount)
    )
  }, [wageAmount, wageType, employee.wageAmount, employee.wageType])

  function payload() {
    return {
      id: employee.id,
      name: name.trim() || 'Untitled',
      jobTitle: jobTitle.trim() || null,
      department: department.trim() || null,
      photoUrl: photoUrl.trim() || null,
      workEmail: workEmail.trim() || null,
      workPhone: workPhone.trim() || null,
      mobile: mobile.trim() || null,
      workStreet: workStreet.trim() || null,
      workCity: workCity.trim() || null,
      workCountry: workCountry.trim() || null,
      privateStreet: privateStreet.trim() || null,
      privateCity: privateCity.trim() || null,
      privateCountry: privateCountry.trim() || null,
      emergencyContact: emergencyContact.trim() || null,
      emergencyPhone: emergencyPhone.trim() || null,
      skills: skills.trim() || null,
      notes: notes.trim() || null,
      employmentType,
      hiredAt: hiredAt.trim() || null,
      leftAt: leftAt.trim() || null,
      managerId: managerId || null,
      userId: userId || null,
      wageType,
      wageAmount: wageAmount.trim() || '0',
      expenseAccountId: expenseAccountId || null,
      payableAccountId: payableAccountId || null,
      active: employee.active,
      wageRaiseNote: wageChanged ? wageRaiseNote.trim() || null : null,
    }
  }

  function save() {
    if (!canUpdate) return
    startBusy(async () => {
      const result = await updateEmployee(payload())
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save')
        return
      }
      toast.success(wageChanged ? 'Saved — wage change recorded' : 'Saved')
      setWageRaiseNote('')
      router.refresh()
    })
  }

  function toggleActive() {
    if (!canUpdate) return
    startBusy(async () => {
      const result = await setEmployeeActive({ id: employee.id, active: !employee.active })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not update')
        return
      }
      toast.success(employee.active ? 'Archived' : 'Restored to active')
      router.refresh()
    })
  }

  function remove() {
    if (!canDelete) return
    if (!window.confirm(`Delete ${employee.name} forever?`)) return
    startBusy(async () => {
      const result = await deleteEmployee({ id: employee.id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success('Deleted')
      router.push('/employees')
      router.refresh()
    })
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="grid max-w-4xl gap-6">
      <section className="flex flex-wrap items-start gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-medium text-muted-foreground">
            {initial}
          </span>
        )}
        <div className="min-w-[16rem] flex-1 space-y-3">
          <Field label="Photo URL">
            <Input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              disabled={!canUpdate}
              placeholder="https://…"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canUpdate} />
            </Field>
            <Field label="Job title">
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={!canUpdate} />
            </Field>
          </div>
        </div>
      </section>

      <Section title="Work">
        <Field label="Department">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Employment type">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as Employee['employmentType'])}
            disabled={!canUpdate}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="INTERN">Intern</option>
          </select>
        </Field>
        <Field label="Manager">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            disabled={!canUpdate}
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
        <Field label="Link login user">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!canUpdate}
          >
            <option value="">None</option>
            {linkableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work email">
          <Input
            type="email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Work phone">
          <Input value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Mobile">
          <Input value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Hired on">
          <Input type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Left on">
          <Input type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} disabled={!canUpdate} />
        </Field>
      </Section>

      <Section title="Work address">
        <Field label="Street">
          <Input value={workStreet} onChange={(e) => setWorkStreet(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="City">
          <Input value={workCity} onChange={(e) => setWorkCity(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Country">
          <Input value={workCountry} onChange={(e) => setWorkCountry(e.target.value)} disabled={!canUpdate} />
        </Field>
      </Section>

      <Section title="Private address">
        <Field label="Street">
          <Input value={privateStreet} onChange={(e) => setPrivateStreet(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="City">
          <Input value={privateCity} onChange={(e) => setPrivateCity(e.target.value)} disabled={!canUpdate} />
        </Field>
        <Field label="Country">
          <Input value={privateCountry} onChange={(e) => setPrivateCountry(e.target.value)} disabled={!canUpdate} />
        </Field>
      </Section>

      <Section title="Emergency">
        <Field label="Contact name">
          <Input
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            disabled={!canUpdate}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            disabled={!canUpdate}
          />
        </Field>
      </Section>

      <Section title="Wage (payroll)">
        <Field label="Wage type">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={wageType}
            onChange={(e) => setWageType(e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY')}
            disabled={!canUpdate}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="DAILY">Daily</option>
            <option value="HOURLY">Hourly</option>
          </select>
        </Field>
        <Field label="Amount">
          <Input value={wageAmount} onChange={(e) => setWageAmount(e.target.value)} disabled={!canUpdate} />
        </Field>
        {canUpdate && wageChanged ? (
          <Field label="Raise / change note">
            <Input
              value={wageRaiseNote}
              onChange={(e) => setWageRaiseNote(e.target.value)}
              placeholder="e.g. Annual raise 2026, promotion"
            />
          </Field>
        ) : null}
        <Field label="Wage expense account">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={expenseAccountId}
            onChange={(e) => setExpenseAccountId(e.target.value)}
            disabled={!canUpdate}
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payable account (optional)">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
            value={payableAccountId}
            onChange={(e) => setPayableAccountId(e.target.value)}
            disabled={!canUpdate}
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        {wageChanges.length > 0 ? (
          <div className="sm:col-span-2 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">Wage change history</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Raises and cuts recorded when the wage amount or type is saved.
            </p>
            <ol className="mt-3 space-y-2">
              {wageChanges.map((change) => (
                <li
                  key={change.at}
                  className="border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="font-medium">{change.actorName}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {Number(change.fromAmount).toFixed(2)} ({change.fromType.toLowerCase()}) →{' '}
                        {Number(change.toAmount).toFixed(2)} ({change.toType.toLowerCase()})
                      </span>
                    </span>
                    <span className="tabular text-xs text-muted-foreground">
                      {formatDateTime(new Date(change.at), timeZone)}
                    </span>
                  </div>
                  {change.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{change.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Section>

      <Section title="Skills & notes" cols={1}>
        <Field label="Skills (comma-separated)">
          <Input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            disabled={!canUpdate}
            placeholder="cashier, inventory, Somali"
          />
        </Field>
        <Field label="Notes">
          <textarea
            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canUpdate}
            rows={4}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap gap-2">
        {canUpdate ? (
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        ) : null}
        {canUpdate ? (
          <Button type="button" variant="outline" disabled={busy} onClick={toggleActive}>
            {employee.active ? 'Archive' : 'Restore'}
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="destructive" disabled={busy} onClick={remove}>
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  cols = 2,
}: {
  title: string
  children: React.ReactNode
  cols?: 1 | 2
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className={cols === 1 ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>{children}</div>
    </section>
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
