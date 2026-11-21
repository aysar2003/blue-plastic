import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WidgetResult } from '@/server/services/company-snapshot.service'

export function SnapshotWidget({
  title,
  caption,
  href,
  hrefLabel = 'Open',
  className,
  children,
}: {
  title: string
  caption?: string
  href?: string
  hrefLabel?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col rounded-2xl border-border/60 bg-card/95 shadow-sm transition hover:shadow-md',
        className,
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </CardTitle>
          {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-primary hover:underline"
          >
            {hrefLabel}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  )
}

export function WidgetBody<T>({
  result,
  children,
  empty = 'No data for this graph.',
}: {
  result: WidgetResult<T>
  children: (data: T) => React.ReactNode
  empty?: string
}) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive"
      >
        <p className="font-medium">Panel unavailable</p>
        <p className="mt-1 text-muted-foreground">{result.error}</p>
      </div>
    )
  }
  const rendered = children(result.data)
  if (rendered == null) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return <>{rendered}</>
}
