import Link from 'next/link'

import { cn } from '@/lib/utils'

export function ChartFrame({
  title,
  caption,
  href,
  hrefLabel = 'View',
  className,
  children,
  actions,
  tall,
}: {
  title: string
  caption?: string
  href?: string
  hrefLabel?: string
  className?: string
  children: React.ReactNode
  actions?: React.ReactNode
  tall?: boolean
}) {
  return (
    <section
      className={cn(
        'analytics-chart flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.05)]',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {caption ? (
            <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {href ? (
            <Link
              href={href}
              className="rounded-full bg-muted/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {hrefLabel}
            </Link>
          ) : null}
        </div>
      </header>
      <div className={cn('flex-1 px-3 pb-3.5 pt-1', tall && 'min-h-[16rem]')}>{children}</div>
    </section>
  )
}
