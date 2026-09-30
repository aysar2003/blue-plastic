'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
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
import type { LauncherApp, LauncherIcon } from './launcher-apps'

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

/**
 * Home screen as an app switcher: white tiles, coloured marks, labels underneath.
 * Clicking a tile leaves the launcher and enters the module shell.
 */
export function AppLauncher({
  apps,
  orgName,
  userName,
}: {
  apps: LauncherApp[]
  orgName: string
  userName: string
}) {
  const first = userName.split(' ')[0] || userName

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
      <div className="mb-10 text-center sm:mb-12">
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
          style={{ animation: 'launcher-fade 480ms ease both' }}
        >
          {orgName}
        </p>
        <h1
          className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl"
          style={{ animation: 'launcher-fade 560ms ease both' }}
        >
          Welcome back, {first}
        </h1>
        <p
          className="mx-auto mt-2 max-w-md text-sm text-slate-500"
          style={{ animation: 'launcher-fade 640ms ease both' }}
        >
          Choose an app to open the books.
        </p>
      </div>

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

function AppTile({ app }: { app: LauncherApp }) {
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
      <span className="max-w-[6.5rem] text-center text-[0.8125rem] font-medium leading-snug text-slate-700 transition-colors group-hover:text-slate-950">
        {app.label}
      </span>
    </Link>
  )
}
