'use client'

import { useState } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'

export function RowGroup({
  title,
  columns,
  total,
  children,
}: {
  title: string
  columns: number
  /** Shown on the band when it is folded, so the lower accounts still add up. */
  total?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <TableRow className="hover:bg-primary/5">
        <TableCell className="py-1.5 pl-6">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm font-medium text-primary"
          >
            {open ? '▾' : '▸'} {title}
          </button>
        </TableCell>
        {Array.from({ length: Math.max(0, columns - 1) }, (_, index) => (
          <TableCell key={index} className={index === 2 && !open && total ? 'numeric tabular font-medium' : undefined}>
            {index === 2 && !open ? total : null}
          </TableCell>
        ))}
      </TableRow>
      {open ? children : null}
    </>
  )
}
