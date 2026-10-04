import * as React from 'react'

import type { CardTone } from '@/lib/card-tones'
import { cn } from '@/lib/utils'

/**
 * A panel, not a floating tile.
 *
 * Pass `tone` when the card is a figure or a kind of work (stock, money,
 * danger…) so its colour says what it is. Leave tone off for forms and tables.
 */
function Card({
  className,
  tone,
  ...props
}: React.ComponentProps<'div'> & {
  /** Semantic colour — see lib/card-tones. */
  tone?: CardTone
}) {
  return (
    <div
      data-slot="card"
      data-tone={tone ?? 'neutral'}
      className={cn('rounded-md border bg-card text-card-foreground', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1 p-4', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-sm font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-xs text-muted-foreground', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-4 pt-0', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
