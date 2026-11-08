import { cn } from '@/lib/utils'

/** Quiet Main / Sub mark — uses theme muted text so every skin stays on-brand. */
export function ChartRoleMark({
  role,
  className,
  title,
}: {
  role: 'main' | 'sub'
  className?: string
  title?: string
}) {
  return (
    <span
      className={cn(
        'shrink-0 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
      title={title}
    >
      {role === 'main' ? 'Main' : 'Sub'}
    </span>
  )
}

/** Tree elbow under a main account — border tokens follow the active theme. */
export function ChartSubElbow({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} aria-hidden>
      <span className="mr-2 inline-block h-4 w-3 border-b border-l border-primary/35" />
    </span>
  )
}
