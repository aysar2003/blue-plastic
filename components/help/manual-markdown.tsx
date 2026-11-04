import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Tiny markdown subset for the in-app user manual (no extra dependency).
 * Supports: # / ## / ### headings, paragraphs, - and 1. lists, **bold**, [text](href).
 */
export function ManualMarkdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').trim().split(/\n\n+/)
  const out: ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!.trim()
    if (!block) continue

    if (block.startsWith('### ')) {
      out.push(
        <h3 key={i} className="mt-5 text-sm font-semibold text-foreground">
          {inline(block.slice(4))}
        </h3>,
      )
      continue
    }
    if (block.startsWith('## ')) {
      out.push(
        <h2 key={i} className="mt-6 text-base font-semibold text-foreground">
          {inline(block.slice(3))}
        </h2>,
      )
      continue
    }
    if (block.startsWith('# ')) {
      out.push(
        <h1 key={i} className="mt-4 text-lg font-semibold text-foreground">
          {inline(block.slice(2))}
        </h1>,
      )
      continue
    }

    const lines = block.split('\n')
    const isUl = lines.every((l) => /^[-*] /.test(l.trim()) || l.trim() === '')
    const isOl = lines.every((l) => /^\d+\. /.test(l.trim()) || l.trim() === '')

    if (isUl) {
      out.push(
        <ul key={i} className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{inline(l.trim().replace(/^[-*] /, ''))}</li>
            ))}
        </ul>,
      )
      continue
    }

    if (isOl) {
      out.push(
        <ol key={i} className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{inline(l.trim().replace(/^\d+\. /, ''))}</li>
            ))}
        </ol>,
      )
      continue
    }

    out.push(
      <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {inline(block.replace(/\n/g, ' '))}
      </p>,
    )
  }

  return <div className="max-w-3xl">{out}</div>
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const token = m[0]!
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={k++} className="font-medium text-foreground">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        const href = link[2]!
        const label = link[1]!
        if (href.startsWith('/')) {
          nodes.push(
            <Link key={k++} href={href} className="text-foreground underline underline-offset-4">
              {label}
            </Link>,
          )
        } else {
          nodes.push(
            <a
              key={k++}
              href={href}
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              {label}
            </a>,
          )
        }
      }
    }
    last = m.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
