'use client'

import { DownloadIcon, PrinterIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'

/**
 * Print and export, for a list.
 *
 * Export downloads a real `.xlsx` with the company letterhead and a formatted
 * table (phones as text, money as numbers). It covers **every row the current
 * filter matches**, not the page on screen.
 *
 * Print uses the browser. `print.css` hides the chrome — sidebar, toolbar, row
 * menus — so the page prints as the table it is.
 */
export function TableToolbar({ exportHref, iconsOnly = false }: { exportHref?: string; iconsOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1 print:hidden">
      {exportHref ? (
        <a
          href={exportHref}
          download
          className={buttonVariants({ variant: 'ghost', size: iconsOnly ? 'icon-sm' : 'sm' })}
          title="Every row matching the current filter, as Excel with company header"
          aria-label="Export"
        >
          <DownloadIcon />
          {iconsOnly ? null : 'Export'}
        </a>
      ) : null}
      <Button variant="ghost" size={iconsOnly ? 'icon-sm' : 'sm'} onClick={() => window.print()} aria-label="Print">
        <PrinterIcon />
        {iconsOnly ? null : 'Print'}
      </Button>
    </div>
  )
}
