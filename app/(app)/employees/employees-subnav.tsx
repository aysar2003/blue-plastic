'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const SECTION_HREFS = [
  '/employees/contracts',
  '/employees/leave',
  '/employees/attendance',
  '/employees/payroll',
  '/employees/settings',
  '/employees/budget',
  '/employees/policies',
  '/employees/guide',
] as const

const TABS = [
  { href: '/employees', label: 'Directory', permission: 'hr:read', exact: true },
  { href: '/employees/contracts', label: 'Contracts', permission: 'hr:read' },
  { href: '/employees/leave', label: 'Leave', permission: 'hr:leave' },
  { href: '/employees/attendance', label: 'Attendance', permission: 'hr:attendance' },
  { href: '/employees/payroll', label: 'Payroll', permission: 'hr:payroll' },
  { href: '/employees/settings', label: 'Settings', permission: 'hr:read' },
  { href: '/employees/budget', label: 'Budget', permission: 'hr:read' },
  { href: '/employees/policies', label: 'Policies', permission: 'hr:read' },
  { href: '/employees/guide', label: 'Guide', permission: 'hr:read' },
] as const

function isDirectoryPath(pathname: string) {
  if (pathname === '/employees') return true
  if (SECTION_HREFS.some((href) => pathname === href || pathname.startsWith(`${href}/`))) return false
  return /^\/employees\/[^/]+$/.test(pathname)
}

export function EmployeesSubnav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname()
  const allowed = new Set(permissions)
  const visible = TABS.filter((tab) => allowed.has(tab.permission) || allowed.has('hr:read'))

  return (
    <nav className="mb-4 flex gap-0.5 overflow-x-auto border-b border-border pb-2" aria-label="Employees sections">
      {visible.map((tab) => {
        const on =
          'exact' in tab && tab.exact
            ? isDirectoryPath(pathname)
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm transition',
              on
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
