import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { AssemblyBuildForm } from '@/components/inventory/assembly-build-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as assemblyBuildService from '@/server/services/assembly-build.service'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Build assemblies' }

export default async function NewAssemblyBuildPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:adjust')
  const query = await searchParams
  const itemId = typeof query.item === 'string' ? query.item : undefined

  const [assemblies, shelf, documentNumber] = await Promise.all([
    assemblyBuildService.listAssemblies(ctx),
    storeService.quantities(ctx),
    peekDocumentNumber(db, ctx.orgId, 'ASSEMBLY_BUILD'),
  ])

  return (
    <>
      <PageHeader
        title="Build assemblies"
        description="Produce finished goods from a bill of materials. Components leave stock at average cost; the assembly arrives on hand valued at those materials — so a later sale posts the right cost of goods sold."
      />

      <AssemblyBuildForm
        assemblies={assemblies}
        stores={shelf.stores.map((store) => ({
          id: store.id,
          label: store.name,
          isOffice: store.isOffice,
        }))}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        initialItemId={itemId}
      />
    </>
  )
}
