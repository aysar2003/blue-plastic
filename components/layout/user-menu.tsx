'use client'

import Link from 'next/link'
import { DatabaseIcon, LogOutIcon, PaletteIcon, PieChartIcon, UserIcon } from 'lucide-react'

import { signOutWithHistory } from '@/app/(app)/auth/actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu({
  user,
  roleLabel,
  showDatabases = false,
  showCompanyReports = false,
}: {
  user: { name: string; email: string; image: string | null }
  roleLabel: string
  /** Databases app — system owner, or an admin who was given Connect. */
  showDatabases?: boolean
  /** Consolidated figures for the company group (or all companies for system owner). */
  showCompanyReports?: boolean
}) {
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar>
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initials || <UserIcon className="size-4" />}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserIcon />
            Your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/appearance">
            <PaletteIcon />
            Appearance
          </Link>
        </DropdownMenuItem>
        {showDatabases ? (
          <DropdownMenuItem asChild>
            <Link href="/databases">
              <DatabaseIcon />
              Close company
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showCompanyReports ? (
          <DropdownMenuItem asChild>
            <Link href="/reports/companies">
              <PieChartIcon />
              Company reports
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void signOutWithHistory(showDatabases ? '/login/staff' : '/login/company')
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
