'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/** Downloads the rows already on screen as a Word file. Word opens this HTML. */
export function WordFile({
  filename,
  title,
  rows,
}: {
  filename: string
  title: string
  rows: string[][]
}) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault()
        const body = rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(cell)}</td>`).join('')}</tr>`,
          )
          .join('')
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><table>${body}</table></body></html>`
        const blob = new Blob([html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
      }}
    >
      Word
    </DropdownMenuItem>
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
