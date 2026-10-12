import type { AccountType } from '@prisma/client'
import {
  LandmarkIcon,
  PackageIcon,
  ReceiptIcon,
  ScaleIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'

import { ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { cn } from '@/lib/utils'

const ICONS: Record<AccountType, LucideIcon> = {
  ASSET: WalletIcon,
  LIABILITY: ScaleIcon,
  EQUITY: LandmarkIcon,
  REVENUE: TrendingUpIcon,
  COGS: PackageIcon,
  EXPENSE: ReceiptIcon,
}

/** Soft fill matched to the chart-of-accounts row colours. */
const TONE: Record<AccountType, string> = {
  ASSET: 'bg-sky-100 text-sky-800',
  LIABILITY: 'bg-amber-100 text-amber-900',
  EQUITY: 'bg-stone-200 text-stone-800',
  REVENUE: 'bg-emerald-100 text-emerald-900',
  COGS: 'bg-orange-100 text-orange-950',
  EXPENSE: 'bg-rose-100 text-rose-900',
}

const SIZES = {
  sm: { box: 'size-6', icon: 'size-3' },
  md: { box: 'size-7', icon: 'size-3.5' },
  lg: { box: 'size-8', icon: 'size-4' },
} as const

/**
 * The mark for one statement type — assets, liabilities, equity, income,
 * cost of goods sold, or expenses. Used in the chart column, pickers, and
 * every place an account is named.
 */
export function AccountTypeIcon({
  type,
  size = 'md',
  className,
}: {
  type: AccountType
  size?: keyof typeof SIZES
  className?: string
}) {
  const Icon = ICONS[type]
  const dims = SIZES[size]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md',
        dims.box,
        TONE[type],
        className,
      )}
      title={ACCOUNT_TYPE_LABELS[type]}
    >
      <Icon className={dims.icon} aria-hidden />
      <span className="sr-only">{ACCOUNT_TYPE_LABELS[type]}</span>
    </span>
  )
}

/** Icon plus the type name — filter chips and section headings. */
export function AccountTypeMark({
  type,
  label,
  size = 'sm',
  className,
}: {
  type: AccountType
  label?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <AccountTypeIcon type={type} size={size} />
      <span>{label ?? ACCOUNT_TYPE_LABELS[type]}</span>
    </span>
  )
}
