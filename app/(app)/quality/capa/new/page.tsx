import type { Metadata } from 'next'

import { createCapa } from '@/app/(app)/quality/capa/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'

export const metadata: Metadata = { title: 'New CAPA' }

export default async function NewCapaPage() {
  const ctx = await requireOrgContext('docs:create')
  const [number, members, vendors] = await Promise.all([
    peekDocumentNumber(db, ctx.orgId, 'CAPA_NOTE'),
    db.membership.findMany({
      where: { orgId: ctx.orgId },
      select: { user: { select: { id: true, name: true } } },
      take: 100,
    }),
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 300,
    }),
  ])

  return (
    <>
      <PageHeader title="New CAPA" description="Record a corrective or preventive action." />
      <form action={createCapa} className="mx-auto max-w-lg space-y-3">
        <Input name="number" defaultValue={number} />
        <Input name="title" required placeholder="Title" />
        <Input name="body" placeholder="Details (optional)" />
        <NativeSelect name="ownerId">
          <option value="">Owner</option>
          {members.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.name}
            </option>
          ))}
        </NativeSelect>
        <Input name="dueDate" type="date" />
        <Input name="rootCause" placeholder="Root cause" />
        <NativeSelect name="vendorId">
          <option value="">Vendor (optional)</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.displayName}
            </option>
          ))}
        </NativeSelect>
        <Input name="lotNumber" placeholder="Lot / batch" />
        <Button type="submit">Create</Button>
      </form>
    </>
  )
}