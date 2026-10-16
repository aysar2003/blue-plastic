import Link from 'next/link'

import { PRODUCT_KIND, PRODUCT_MARK, PRODUCT_NAME } from '@/lib/product-brand'

/**
 * Shared SOM ERP mark + name — same language on landing and auth.
 * Brand sits beside the mark so the product name reads as one signal.
 */
export function ProductWordmark({
  href = '/',
  size = 'md',
  className,
}: {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const mark =
    size === 'lg' ? 'size-12 text-sm' : size === 'sm' ? 'size-9 text-[13px]' : 'size-10 text-[13px]'
  const name =
    size === 'lg'
      ? 'text-[1.65rem] sm:text-[1.85rem]'
      : size === 'sm'
        ? 'text-[17px]'
        : 'text-[1.25rem]'
  const kind =
    size === 'lg' ? 'text-[11px] tracking-[0.2em]' : 'text-[10px] tracking-[0.16em]'

  return (
    <Link href={href} className={`group inline-flex items-center gap-3 ${className ?? ''}`}>
      <span
        className={`grid shrink-0 place-items-center rounded-md bg-primary font-bold tracking-wide text-primary-foreground shadow-[0_10px_28px_-12px_var(--glow)] ${mark}`}
      >
        {PRODUCT_MARK}
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className={`block font-bold tracking-[-0.03em] text-foreground ${name}`}>
          {PRODUCT_NAME}
        </span>
        <span className={`mt-0.5 block font-semibold uppercase text-success ${kind}`}>
          {PRODUCT_KIND}
        </span>
      </span>
    </Link>
  )
}
