import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as hris from '@/server/services/hris.service'

import {
  createApplicant,
  createAppraisal,
  createJobOpening,
  hireApplicant,
  moveApplicant,
  rejectApplicant,
  reopenOpening,
  setLifecycle,
  syncWage,
} from './actions'

export const metadata: Metadata = { title: 'Recruitment' }

export default async function RecruitmentPage() {
  const ctx = await requireOrgContext('hr:read')
  const [board, employees] = await Promise.all([
    hris.listRecruitment(ctx),
    db.employee.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, name: true, lifecycleStatus: true, active: true },
      orderBy: { name: 'asc' },
      take: 80,
    }),
  ])

  return (
    <>
      <PageHeader
        title="Recruitment & appraisals"
        description="Openings, screening → interview → offer → hire, lifecycle, and appraisals."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">Employees</Link>
          </Button>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">New job opening</h2>
          <form action={createJobOpening} className="space-y-2">
            <Input name="title" placeholder="Title" required />
            <Input name="department" placeholder="Department" />
            <Button type="submit" size="sm">
              Post opening
            </Button>
          </form>
          <ul className="text-sm">
            {board.openings.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                {row.title} · {row.status}
                {row.status !== 'OPEN' ? (
                  <form action={reopenOpening}>
                    <input type="hidden" name="jobOpeningId" value={row.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Reopen
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Applicant</h2>
          <form action={createApplicant} className="space-y-2">
            <Label>Opening</Label>
            <select name="jobOpeningId" className="w-full rounded-md border px-2 py-1.5 text-sm" required>
              {board.openings
                .filter((o) => o.status === 'OPEN')
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
            </select>
            <Input name="name" placeholder="Name" required />
            <Input name="email" placeholder="Email" />
            <Button type="submit" size="sm">
              Add applicant
            </Button>
          </form>
          <ul className="space-y-2 text-sm">
            {board.applicants.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                {row.name} · {row.jobOpening.title} · {row.status}
                {row.status === 'NEW' ? (
                  <form action={moveApplicant}>
                    <input type="hidden" name="applicantId" value={row.id} />
                    <input type="hidden" name="status" value="SCREENING" />
                    <Button type="submit" size="sm" variant="outline">
                      Screen
                    </Button>
                  </form>
                ) : null}
                {row.status === 'SCREENING' ? (
                  <form action={moveApplicant}>
                    <input type="hidden" name="applicantId" value={row.id} />
                    <input type="hidden" name="status" value="INTERVIEW" />
                    <Button type="submit" size="sm" variant="outline">
                      Interview
                    </Button>
                  </form>
                ) : null}
                {row.status === 'INTERVIEW' ? (
                  <form action={moveApplicant}>
                    <input type="hidden" name="applicantId" value={row.id} />
                    <input type="hidden" name="status" value="OFFER" />
                    <Button type="submit" size="sm" variant="outline">
                      Offer
                    </Button>
                  </form>
                ) : null}
                {row.status === 'OFFER' ? (
                  <form action={hireApplicant}>
                    <input type="hidden" name="applicantId" value={row.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Hire
                    </Button>
                  </form>
                ) : null}
                {row.status !== 'HIRED' && row.status !== 'REJECTED' ? (
                  <form action={rejectApplicant}>
                    <input type="hidden" name="applicantId" value={row.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Reject
                    </Button>
                  </form>
                ) : null}
                {row.employee ? (
                  <Link href={`/employees/${row.employee.id}`} className="text-primary underline">
                    {row.employee.name}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-8 space-y-3 p-4">
        <h2 className="font-medium">Employment lifecycle</h2>
        <ul className="space-y-2 text-sm">
          {employees.map((emp) => (
            <li key={emp.id} className="flex flex-wrap items-center gap-2">
              <Link href={`/employees/${emp.id}`} className="font-medium hover:underline">
                {emp.name}
              </Link>
              <span className="text-muted-foreground">{emp.lifecycleStatus}</span>
              <form action={setLifecycle} className="flex gap-1">
                <input type="hidden" name="employeeId" value={emp.id} />
                <select name="status" className="rounded-md border px-1 text-xs" defaultValue={emp.lifecycleStatus}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="LEFT">LEFT</option>
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Save
                </Button>
              </form>
              <form action={syncWage}>
                <input type="hidden" name="employeeId" value={emp.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Sync wage from contract
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Appraisal</h2>
        <form action={createAppraisal} className="flex flex-wrap gap-2">
          <select name="employeeId" className="rounded-md border px-2 py-1.5 text-sm" required>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <Input name="periodLabel" placeholder="2026 H1" required className="max-w-[140px]" />
          <Input name="score" placeholder="Score 0–100" className="max-w-[120px]" />
          <Input name="goals" placeholder="Goals" className="max-w-[220px]" />
          <Button type="submit" size="sm">
            Save review
          </Button>
        </form>
        <ul className="text-sm">
          {board.appraisals.map((row) => (
            <li key={row.id}>
              {row.employee.name} · {row.periodLabel}
              {row.score ? ` · ${row.score}` : ''}
              {row.goals ? ` · ${row.goals}` : ''}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
