'use client'

import Link from 'next/link'
import { DownloadIcon, EyeIcon, FileTextIcon, PrinterIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import {
  documentPackSearch,
  listExportHref,
  purchasesPackPdfHref,
  purchasesPackPrintHref,
  salesPackPdfHref,
  salesPackPrintHref,
  singleDocumentPdfHref,
} from '@/lib/document-pack'
import { cn } from '@/lib/utils'

export type PackOne = {
  id: string
  href: string
  printHref: string
}

export function PackActions({
  area,
  slug,
  selectedIds,
  partyId,
  partyParam = 'customer',
  listParams,
  exportSlug,
  one,
}: {
  area: 'sales' | 'purchases'
  slug: string
  selectedIds: string[]
  partyId?: string
  partyParam?: 'customer' | 'vendorId'
  listParams: Record<string, string | undefined>
  exportSlug: string
  one?: PackOne | null
}) {
  const links = packLinks({
    area,
    slug,
    selectedIds,
    partyId,
    partyParam,
    listParams,
    exportSlug,
    one,
  })

  return (
    <div className="flex flex-wrap items-center gap-1">
      <PackLink href={links.viewHref} disabled={!links.canPack} label="View" icon={EyeIcon} />
      <PackLink href={links.printHref} disabled={!links.canPack} label="Print" icon={PrinterIcon} />
      <PackLink href={links.pdfHref} disabled={!links.canPack} label="PDF" icon={FileTextIcon} />
      <a
        href={links.excelHref}
        download
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        title={
          selectedIds.length
            ? `Excel for ${selectedIds.length} selected paper${selectedIds.length === 1 ? '' : 's'}`
            : 'Excel for every row matching the current filter'
        }
      >
        <DownloadIcon />
        Excel
      </a>
    </div>
  )
}

function PackLink({
  href,
  disabled,
  label,
  icon: Icon,
}: {
  href: string
  disabled: boolean
  label: string
  icon: typeof EyeIcon
}) {
  const className = cn(buttonVariants({ variant: 'outline', size: 'sm' }), disabled && 'pointer-events-none opacity-50')
  if (disabled) {
    return (
      <span className={className} title="Select papers or pick a name">
        <Icon />
        {label}
      </span>
    )
  }
  return (
    <Link href={href} className={className} title={label}>
      <Icon />
      {label}
    </Link>
  )
}

export function packLinks({
  area,
  slug,
  selectedIds,
  partyId,
  partyParam = 'customer',
  listParams,
  exportSlug,
  one,
}: {
  area: 'sales' | 'purchases'
  slug: string
  selectedIds: string[]
  partyId?: string
  partyParam?: 'customer' | 'vendorId'
  listParams: Record<string, string | undefined>
  exportSlug: string
  one?: PackOne | null
}) {
  const packQuery = documentPackSearch({
    ids: selectedIds,
    customer: partyParam === 'customer' ? partyId : undefined,
    vendorId: partyParam === 'vendorId' ? partyId : undefined,
    status: listParams.status,
    date: listParams.date,
  })
  const canPack = selectedIds.length > 0 || Boolean(partyId)
  const printPack =
    area === 'sales' ? salesPackPrintHref(slug, packQuery) : purchasesPackPrintHref(slug, packQuery)
  const pdfPack = area === 'sales' ? salesPackPdfHref(slug, packQuery) : purchasesPackPdfHref(slug, packQuery)
  const single = selectedIds.length === 1 && one ? one : null

  return {
    canPack,
    viewHref: single?.href ?? printPack,
    printHref: single?.printHref ?? printPack,
    pdfHref: single ? singleDocumentPdfHref(area, single.id) : pdfPack,
    excelHref: listExportHref(exportSlug, listParams, selectedIds),
  }
}
