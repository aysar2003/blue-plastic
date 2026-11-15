import type { Metadata } from 'next'

import { createCapa } from '@/app/(app)/quality/capa/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'

export const metadata: Metadata = { title: 'New CAPA' }

export default async function NewCapaPage() {
  const ctx = await requireOrgContext('docs:create')
  const number = await peekDocumentNumber(db, ctx.orgId, 'CAPA_NOTE')

  return (
    <>
      <PageHeader title="New CAPA" description="Record a corrective or preventive action." />
      <form action={createCapa} className="mx-auto max-w-lg space-y-3">
        <Input name="number" defaultValue={number} />
        <Input name="title" required placeholder="Title" />
        <Input name="body" placeholder="Details (optional)" />
        <Button type="submit">Create</Button>
      </form>
    </>
  )
}