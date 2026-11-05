import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as assemblyBuildService from '@/server/services/assembly-build.service'
import * as storeService from '@/server/services/store.service'

import { createWorkOrder } from '../actions'

export const metadata: Metadata = { title: 'New work order' }

export default async function NewWorkOrderPage() {
  const ctx = await requireOrgContext('inventory:adjust')
  const [assemblies, shelf, documentNumber] = await Promise.all([
    assemblyBuildService.listAssemblies(ctx),
    storeService.quantities(ctx),
    peekDocumentNumber(db, ctx.orgId, 'WORK_ORDER'),
  ])
  const day = today(ctx.organization.timeZone)

  return (
    <>
      <PageHeader
        title="New work order"
        description="Choose an assembly and quantity. Completing the order later posts the same stock movements as Build assemblies."
      />
      <form action={createWorkOrder} className="mx-auto max-w-lg space-y-3">
        <Input name="number" defaultValue={documentNumber} placeholder="Number" />
        <Input name="date" type="date" defaultValue={day} required />
        <Input name="dueDate" type="date" />
        <NativeSelect name="itemId" required>
          <option value="">Assembly…</option>
          {assemblies.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="storeId">
          <option value="">Default store</option>
          {shelf.stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </NativeSelect>
        <Input name="quantity" defaultValue="1" required />
        <Input name="memo" placeholder="Memo (optional)" />
        <Button type="submit">Create draft</Button>
      </form>
    </>
  )
}
