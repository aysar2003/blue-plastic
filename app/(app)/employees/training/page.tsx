import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { TRAINING_LEGAL, canCompleteTraining, canFailTraining, type TrainingStatus } from '@/lib/erp/training'
import { requireOrgContext } from '@/server/auth/context'
import * as training from '@/server/services/training.service'

import { completeEnrollment, createCourse, enroll, failEnrollment } from './actions'

export const metadata: Metadata = { title: 'Training' }

export default async function TrainingPage() {
  const ctx = await requireOrgContext('hr:read')
  const board = await training.listBoard(ctx)
  const canUpdate = ctx.permissions.has('hr:update')

  return (
    <>
      <PageHeader title="Training" description="Courses and who completed them." />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{TRAINING_LEGAL}</p>
      {canUpdate ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-4">
            <h2 className="font-medium">New course</h2>
            <form action={createCourse} className="space-y-2">
              <Input name="title" placeholder="Title" required />
              <Input name="hours" placeholder="Hours" />
              <Button type="submit" size="sm">
                Add course
              </Button>
            </form>
          </Card>
          <Card className="space-y-2 p-4">
            <h2 className="font-medium">Enroll</h2>
            <form action={enroll} className="space-y-2">
              <NativeSelect name="courseId" required>
                {board.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="employeeId" required>
                {board.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit" size="sm">
                Enroll
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
      <ul className="space-y-2 text-sm">
        {board.enrollments.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {row.employee.name} · {row.course.title} · {row.status}
            </span>
            {canUpdate && canCompleteTraining(row.status as TrainingStatus) ? (
              <form action={completeEnrollment}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Complete
                </Button>
              </form>
            ) : null}
            {canUpdate && canFailTraining(row.status as TrainingStatus) ? (
              <form action={failEnrollment}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Fail
                </Button>
              </form>
            ) : null}
          </li>
        ))}
        {board.enrollments.length === 0 ? (
          <li className="text-muted-foreground">No enrollments yet.</li>
        ) : null}
      </ul>
    </>
  )
}
