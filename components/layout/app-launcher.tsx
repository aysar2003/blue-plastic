'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarRangeIcon,
  CircleHelpIcon,
  HandCoinsIcon,
  NotebookPenIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { LauncherIcon } from './launcher-apps'

const ICONS: Record<LauncherIcon, LucideIcon> = {
  receipt: ReceiptIcon,
  users: UsersIcon,
  'shopping-cart': ShoppingCartIcon,
  building: Building2Icon,
  wallet: WalletIcon,
  'hand-coins': HandCoinsIcon,
  package: PackageIcon,
  book: BookOpenIcon,
  notebook: NotebookPenIcon,
  trending: TrendingUpIcon,
  banknote: BanknoteIcon,
  calendar: CalendarRangeIcon,
  settings: SettingsIcon,
  help: CircleHelpIcon,
}

export type LauncherTile = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  accent: string
  wash: string
  blurb?: string
}

export type LauncherInsight = {
  label: string
  value: string
  hint?: string
  href?: string
}

/**
 * Shared home / module switcher: white tiles, coloured marks, labels underneath.
 */
export function AppLauncher({
  eyebrow,
  title,
  subtitle,
  apps,
  backHref,
  backLabel,
  insights,
}: {
  eyebrow: string
  title: string
  subtitle: string
  apps: LauncherTile[]
  backHref?: string
  backLabel?: string
  insights?: LauncherInsight[]
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:pt-14">
      {backHref ? (
        <div className="mb-6" style={{ animation: 'launcher-fade 400ms ease both' }}>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {backLabel ?? 'Back'}
          </Link>
        </div>
      ) : null}

      <div className="mb-8 text-center sm:mb-10">
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
          style={{ animation: 'launcher-fade 480ms ease both' }}
        >
          {eyebrow}
        </p>
        <h1
          className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl"
          style={{ animation: 'launcher-fade 560ms ease both' }}
        >
          {title}
        </h1>
        <p
          className="mx-auto mt-2 max-w-md text-sm text-slate-500"
          style={{ animation: 'launcher-fade 640ms ease both' }}
        >
          {subtitle}
        </p>
      </div>

      {insights && insights.length > 0 ? (
        <ul
          className="mb-10 grid gap-3 sm:grid-cols-3"
          style={{ animation: 'launcher-fade 700ms ease both' }}
        >
          {insights.map((insight) => {
            const body = (
              <>
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">
                  {insight.label}
                </span>
                <span className="mt-1 block truncate text-lg font-semibold tabular text-slate-800">
                  {insight.value}
                </span>
                {insight.hint ? (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{insight.hint}</span>
                ) : null}
              </>
            )

            return (
              <li key={insight.label}>
                {insight.href ? (
                  <Link
                    href={insight.href}
                    className="block rounded-2xl bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-10px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-10 md:grid-cols-5 lg:grid-cols-6">
        {apps.map((app, index) => (
          <li
            key={app.key}
            style={{
              animation: `launcher-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both`,
              animationDelay: `${80 + index * 28}ms`,
            }}
          >
            <AppTile app={app} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function AppTile({ app }: { app: LauncherTile }) {
  const Icon = ICONS[app.icon]

  return (
    <Link
      href={app.href}
      className={cn(
        'group flex flex-col items-center gap-2.5 outline-none',
        'focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-4',
      )}
    >
      <span
        className={cn(
          'grid size-[4.5rem] place-items-center rounded-2xl bg-white sm:size-[5.25rem]',
          'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-8px_rgba(15,23,42,0.12)]',
          'ring-1 ring-slate-900/5 transition duration-200 ease-out',
          'group-hover:-translate-y-1 group-hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_28px_-10px_rgba(15,23,42,0.18)]',
          'group-active:translate-y-0 group-active:scale-[0.98]',
        )}
      >
        <span
          className="grid size-11 place-items-center rounded-xl sm:size-12"
          style={{ backgroundColor: app.wash, color: app.accent }}
        >
          <Icon className="size-6 sm:size-7" strokeWidth={1.75} aria-hidden />
        </span>
      </span>
      <span className="max-w-[7rem] text-center">
        <span className="block text-[0.8125rem] font-medium leading-snug text-slate-700 transition-colors group-hover:text-slate-950">
          {app.label}
        </span>
        {app.blurb ? (
          <span className="mt-0.5 hidden text-[0.6875rem] leading-snug text-slate-400 sm:block">
            {app.blurb}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
