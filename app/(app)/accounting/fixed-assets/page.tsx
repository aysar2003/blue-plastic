import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as assetService from '@/server/services/fixed-asset.service'

import { DepreciateForm } from './depreciate-form'

export const metadata: Metadata = { title: 'Fixed assets' }

export default async function FixedAssetsPage() {
  const ctx = await requireOrgContext('journal:read')
  const [assets, categories] = await Promise.all([
    assetService.listAssets(ctx),
    assetService.listCategories(ctx),
  ])
  const canPost = ctx.permissions.has('journal:post')
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Fixed assets"
        description="Register plant and equipment, then run monthly straight-line depreciation."
        actions={
          canPost ? (
            <Link href="/accounting/fixed-assets/new" className={buttonVariants({ size: 'sm' })}>
              New asset
            </Link>
          ) : null
        }
      />

      {canPost ? (
        <Card className="mb-6 max-w-md p-4">
          <h2 className="mb-2 text-sm font-semibold">Run depreciation</h2>
          <DepreciateForm />
        </Card>
      ) : null}

      {categories.length === 0 && canPost ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Add a category first (asset / accum. dep. / expense accounts) via{' '}
          <Link href="/accounting/fixed-assets/categories" className="text-primary underline">
            Categories
          </Link>
          .
        </p>
      ) : canPost ? (
        <p className="mb-4 text-sm">
          <Link href="/accounting/fixed-assets/categories" className="text-primary underline">
            Categories ({categories.length})
          </Link>
        </p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Accum. dep.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No fixed assets yet.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.number}</TableCell>
                  <TableCell>{asset.name}</TableCell>
                  <TableCell>{asset.category.name}</TableCell>
                  <TableCell className="text-right tabular">
                    {formatMoney(asset.cost, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatMoney(asset.accumulatedDepreciation, currency)}
                  </TableCell>
                  <TableCell>{asset.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
