import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

import { assignPlanning } from './actions'

export const metadata: Metadata = { title: 'Planning' }

export default async function PlanningPage() {
  const ctx = await requireOrgContext('project:read')
  const week = await collab.planningWeek(ctx)
  const start = toCalendarDate(week.start)

  return (
    <>
      <PageHeader
        title="Planning"
        description="Book people onto days. Project tasks still show when they are assigned to the employee’s login."
      />
      <Card className="mb-6 max-w-xl space-y-3 p-4">
        <form action={assignPlanning} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="employeeId">Person</Label>
            <NativeSelect id="employeeId" name="employeeId" required className="mt-1">
              {week.employees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="workDate">Day</Label>
            <Input id="workDate" name="workDate" type="date" required defaultValue={start} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" name="hours" defaultValue="8" required className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="taskId">Task (optional)</Label>
            <NativeSelect id="taskId" name="taskId" className="mt-1">
              <option value="">—</option>
              {week.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.project.name}: {task.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" className="mt-1" />
          </div>
          <Button type="submit" size="sm">
            Assign
          </Button>
        </form>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>This week</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {week.employees.map((person) => {
              const tasks = week.tasks.filter(
                (t) => t.assigneeId === person.userId || t.assigneeId === person.id,
              )
              const booked = week.assignments.filter((row) => row.employeeId === person.id)
              const hours = booked.reduce((sum, row) => sum + Number(row.hours), 0)
              return (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {hours > 0 ? `${hours}h booked` : 'No hours booked'}
                    {booked.length
                      ? ` · ${booked
                          .map((row) => toCalendarDate(row.workDate))
                          .join(', ')}`
                      : ''}
                    {tasks.length
                      ? ` · tasks: ${tasks
                          .slice(0, 3)
                          .map((t) => t.name)
                          .join(', ')}`
                      : ''}
                  </TableCell>
                </TableRow>
              )
            })}
            {week.employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  Add active employees to fill this grid.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Timesheet entries this week: {week.time.length}
      </p>
    </>
  )
}
