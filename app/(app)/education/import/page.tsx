import type { Metadata } from 'next'
import Link from 'next/link'

import { importStudentsCsvAction } from '@/app/(app)/education/actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Import students' }

export default async function EducationImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    createdStudents?: string
    createdEnrollments?: string
    skippedEnrollments?: string
    errors?: string
  }>
}) {
  await requireOrgContext('invoice:create')
  const result = await searchParams

  return (
    <>
      <PageHeader
        title="Import students"
        description="Bring prior student and enrollment history from a spreadsheet. Existing fee invoices are never overwritten."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      {result.createdStudents !== undefined ? (
        <Card className="mb-6 border-foreground/20">
          <CardContent className="space-y-1 p-4 text-sm">
            <p>
              Students created: <strong>{result.createdStudents}</strong>
            </p>
            <p>
              Enrollments created: <strong>{result.createdEnrollments}</strong>
            </p>
            <p>
              Enrollments skipped (already present): <strong>{result.skippedEnrollments}</strong>
            </p>
            <p>
              Row errors: <strong>{result.errors}</strong>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            CSV headers (any subset):{' '}
            <code className="text-xs">
              displayName, email, phone, studentCode, program, term, year
            </code>
            . For prior years include <code className="text-xs">year</code> +{' '}
            <code className="text-xs">term</code> so history is retained as CLOSED-year enrollments.
          </p>
          <form action={importStudentsCsvAction} className="space-y-3">
            <textarea
              name="csv"
              required
              rows={12}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              placeholder={`displayName,email,phone,studentCode,program,term,year\nAmina Ali,amina@school.test,+25261,STU-001,General,2024 Term 1,2024`}
            />
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Import CSV
            </button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
