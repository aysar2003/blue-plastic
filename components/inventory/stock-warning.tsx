import { AlertTriangleIcon } from 'lucide-react'

import { stockWarningText, type StockWarning } from '@/lib/store-stock'
import { cn } from '@/lib/utils'

/**
 * Amber note on a sale line when stock is at/below zero or this sale takes it
 * below zero. Information only — the sale still goes through, and a later bill
 * brings the store back up.
 */
export function StockWarningNote({
  warning,
  text: override,
  className,
  tone,
}: {
  warning: StockWarning | null | undefined
  /** Shorter wording where space is tight (POS product tiles). */
  text?: string
  className?: string
  /** POS has its own light/dark switch; elsewhere the theme token is used. */
  tone?: 'light' | 'dark'
}) {
  if (!warning) return null
  const text = override ?? stockWarningText(warning)
  const style =
    tone === 'dark'
      ? { color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.35)' }
      : tone === 'light'
        ? { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }
        : undefined
  return (
    <p
      role="status"
      title={`${text} The sale is not blocked; a later purchase bill corrects the stock.`}
      className={cn(
        'mt-1 flex items-start gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-snug',
        !tone && 'border-warning/40 bg-warning/10 text-warning',
        className,
      )}
      style={style}
    >
      <AlertTriangleIcon className="mt-px size-3 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  )
}
