import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as assemblyBuildService from '@/server/services/assembly-build.service'

export const metadata: Metadata = { title: 'MRP' }

export default async function MrpPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; qty?: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const query = await searchParams
  const assemblies = await assemblyBuildService.listAssemblies(ctx)
  const itemId = query.item && assemblies.some((row) => row.id === query.item) ? query.item : assemblies[0]?.id
  const qty = query.qty && Number(query.qty) > 0 ? query.qty : '1'
  const plan = itemId ? await assemblyBuildService.materialsPlan(ctx, itemId, qty) : null
  const short = plan?.lines.filter((row) => row.isShort) ?? []

  return (
    <>
      <PageHeader
        title="Materials plan"
        description="Explode a bill of materials, see leaf shortages, then build or buy."
        actions={
          itemId && short.length === 0 ? (
            <Button asChild size="sm">
              <Link href={`/inventory/builds/new?item=${itemId}&qty=${qty}`}>Build assemblies</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/inventory/builds/new">Build assemblies</Link>
            </Button>
          )
        }
      />
      <Card className="mb-6 max-w-xl p-4">
        <form className="flex flex-wrap items-end gap-2">
          <NativeSelect name="item" defaultValue={itemId} className="min-w-[220px]">
            {assemblies.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </NativeSelect>
          <Input name="qty" defaultValue={qty} className="w-24" />
          <Button type="submit" size="sm">
            Plan
          </Button>
        </form>
      </Card>
      {plan ? (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead className="text-right">Needed</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Short</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.lines.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular">{row.needed}</TableCell>
                  <TableCell className="text-right tabular">{row.onHand}</TableCell>
                  <TableCell className="text-right tabular">{row.isShort ? row.short : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">Add an inventory assembly with a bill of materials first.</p>
      )}
      {short.length > 0 ? (
        <p className="mt-4 text-sm">
          {short.length} part{short.length === 1 ? '' : 's'} short.{' '}
          <Link href="/purchases/purchase-orders/new" className="text-primary underline">
            Raise a purchase order
          </Link>
        </p>
      ) : null}
    </>
  )
}
