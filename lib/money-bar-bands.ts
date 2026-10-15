/**
 * Money-bar segment colours — CSS variables so QuickBooks / Odoo / dark themes
 * stay consistent without hard-coded hex on every page.
 */
export const MONEY_BAR = {
  estimates: { bar: 'bg-[var(--chart-net,#5ec8e5)]', accent: undefined as string | undefined },
  overdue: { bar: 'bg-[var(--warning,#d4652f)]', accent: 'text-[var(--warning,#d4652f)]' },
  open: { bar: 'bg-[color-mix(in_oklab,var(--muted-foreground)_35%,transparent)]', accent: undefined },
  paid: { bar: 'bg-[var(--success,#2ca01c)]', accent: undefined },
  /** Vendor purchase orders — same hue family as estimates. */
  orders: { bar: 'bg-[var(--chart-net,#5ec8e5)]', accent: undefined as string | undefined },
  /** Invoice home — not yet due (cool teal). */
  notDue: { bar: 'bg-[var(--chart-net,#5ec8e5)]', accent: undefined as string | undefined },
  /** Receipt / period slices. */
  today: { bar: 'bg-[var(--success,#2ca01c)]', accent: undefined as string | undefined },
  month: { bar: 'bg-[var(--primary)]', accent: undefined as string | undefined },
  year: { bar: 'bg-[var(--chart-net,#5ec8e5)]', accent: undefined as string | undefined },
  older: { bar: 'bg-[color-mix(in_oklab,var(--muted-foreground)_35%,transparent)]', accent: undefined },
} as const
