import { formatStockQty, stockWarningTitle, type StockWarning } from '@/lib/store-stock'
import { cn } from '@/lib/utils'

/**
 * The stock left after this sale, as a bare red number, only when it is below
 * zero. Nothing when on hand covers the sale. Information only: the sale still
 * goes through and a later bill brings the store back up.
 */
export function StockWarningNote({
  warning,
  className,
  tone,
}: {
  warning: StockWarning | null | undefined
  className?: string
  /** POS has its own light/dark switch; elsewhere the theme's destructive token is used. */
  tone?: 'light' | 'dark'
}) {
  if (!warning || warning.after >= 0) return null
  const title = stockWarningTitle(warning)
  return (
    <p
      role="status"
      title={title}
      aria-label={title}
      className={cn('mt-0.5 text-xs font-semibold tabular-nums leading-tight', !tone && 'text-destructive', className)}
      style={tone ? { color: tone === 'dark' ? '#f87171' : '#d23f3f' } : undefined}
    >
      {formatStockQty(warning.after)}
    </p>
  )
}
