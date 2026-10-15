'use client'

import { ChevronDownIcon, FileDownIcon, PrinterIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  printWithInk,
  rememberPrintInk,
  withPrintInk,
  type PrintInk,
} from '@/lib/print-ink'
import { cn } from '@/lib/utils'

const INK_OPTIONS: { ink: PrintInk; label: string; hint: string }[] = [
  { ink: 'color', label: 'Color', hint: 'Full colour bands and accents' },
  { ink: 'mono', label: 'Black & White', hint: 'Greyscale for plain printers' },
]

/** Print dropdown — Color or Black & White, then browser print. */
export function PrintInkMenu({
  printHref,
  label = 'Print',
  size = 'sm',
  variant = 'outline',
  className,
}: {
  /** Dedicated print page; ink is passed in the query string. */
  printHref?: string
  label?: string
  size?: 'sm' | 'default' | 'icon'
  variant?: 'outline' | 'default' | 'secondary' | 'ghost'
  className?: string
}) {
  const run = (ink: PrintInk) => {
    rememberPrintInk(ink)
    if (printHref) {
      window.location.assign(withPrintInk(printHref, ink))
      return
    }
    printWithInk(ink)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant, size }), className)}
        type="button"
        title="Print — choose Color or Black & White"
      >
        <PrinterIcon />
        {label || null}
        {size === 'icon' ? null : <ChevronDownIcon className="opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Paper ink</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {INK_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.ink} onSelect={() => run(option.ink)}>
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-[0.6875rem] font-normal text-muted-foreground">{option.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** PDF download dropdown — same Color / Black & White choice. */
export function PdfInkMenu({
  pdfHref,
  filename,
  label = 'PDF',
  size = 'sm',
  variant = 'outline',
  className,
  onFallbackPrint,
}: {
  pdfHref?: string
  filename?: string
  label?: string
  size?: 'sm' | 'default' | 'icon'
  variant?: 'outline' | 'default' | 'secondary' | 'ghost'
  className?: string
  /** When there is no PDF route, Print → Save as PDF with the chosen ink. */
  onFallbackPrint?: (ink: PrintInk) => void
}) {
  const run = (ink: PrintInk) => {
    rememberPrintInk(ink)
    if (!pdfHref) {
      if (onFallbackPrint) onFallbackPrint(ink)
      else printWithInk(ink)
      return
    }
    const href = withPrintInk(pdfHref, ink)
    const anchor = document.createElement('a')
    anchor.href = href
    if (filename) anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant, size }), className)}
        type="button"
      >
        <FileDownIcon />
        {label}
        <ChevronDownIcon className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>PDF ink</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {INK_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.ink} onSelect={() => run(option.ink)}>
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-[0.6875rem] font-normal text-muted-foreground">{option.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Compact Print / Save as PDF with ink choice (portal papers). */
export function PortalPrintInkButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PrinterIcon />
          {label}
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Paper ink</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {INK_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.ink} onSelect={() => printWithInk(option.ink)}>
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-[0.6875rem] font-normal text-muted-foreground">{option.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
