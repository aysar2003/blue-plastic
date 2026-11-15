import type { Metadata } from 'next'

import { createServiceJob } from '@/app/(app)/service/jobs/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'

export const metadata: Metadata = { title: 'New service job' }

export default async function NewServiceJobPage() {
  const ctx = await requireOrgContext('invoice:create')
  const [customers, items, vanStores, users, documentNumber] = await Promise.all([
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true, isVan: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.membership.findMany({
      where: { orgId: ctx.orgId },
      select: { user: { select: { id: true, name: true } } },
      take: 100,
    }),
    peekDocumentNumber(db, ctx.orgId, 'SERVICE_JOB'),
  ])
  const day = today(ctx.organization.timeZone)

  return (
    <>
      <PageHeader title="New service job" description="Draft a job with one charge line. Add more on the detail page later." />
      <form action={createServiceJob} className="mx-auto max-w-lg space-y-3">
        <Input name="number" defaultValue={documentNumber} placeholder="Number" />
        <Input name="date" type="date" defaultValue={day} required />
        <NativeSelect name="customerId" required>
          <option value="">Customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="assigneeId">
          <option value="">Assignee</option>
          {users.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="vanStoreId">
          <option value="">Van store</option>
          {vanStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="lineKind" defaultValue="LABOR">
          <option value="LABOR">Labour</option>
          <option value="TRAVEL">Travel</option>
          <option value="PART">Part</option>
        </NativeSelect>
        <NativeSelect name="itemId" required>
          <option value="">Item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.type})
            </option>
          ))}
        </NativeSelect>
        <Input name="lineDescription" placeholder="Line description (optional)" />
        <Input name="quantity" defaultValue="1" required />
        <Input name="unitPrice" defaultValue="0" required />
        <NativeSelect name="lineVanStoreId">
          <option value="">Issue parts from van</option>
          {vanStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <Input name="memo" placeholder="Memo" />
        <Button type="submit">Create draft</Button>
      </form>
    </>
  )
}