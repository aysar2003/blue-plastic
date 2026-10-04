'use client'

import { useState } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'

export function RowGroup({
  title,
  columns,
  children,
}: {
  title: string
  columns: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <TableRow className="hover:bg-primary/5">
        <TableCell colSpan={columns} className="py-1.5 pl-6">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm font-medium text-primary"
          >
            {open ? '▾' : '▸'} {title}
          </button>
        </TableCell>
      </TableRow>
      {open ? children : null}
    </>
  )
}
