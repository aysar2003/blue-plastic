import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as hrPolicyService from '@/server/services/hr-policy.service'

export const metadata: Metadata = { title: 'HR policy' }

export default async function HrPolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('hr:read')
  const { id } = await params
  const policy = await hrPolicyService.get(ctx, id).catch(() => null)
  if (!policy) notFound()

  return (
    <>
      <PageHeader
        title={policy.title}
        description={policy.published ? 'Published' : 'Draft'}
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/policies">All policies</Link>
          </Button>
        }
      />
      <article className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{policy.body || '—'}</article>
      {policy.hasFile ? (
        <p className="mt-4 text-sm">
          <a
            href={`/api/employees/policies/${policy.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            {policy.originalName ?? 'Download attachment'}
          </a>
        </p>
      ) : null}
    </>
  )
}
