'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  DatabaseIcon,
  PlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type CompanyOption = {
  id: string
  name: string
  isCurrent: boolean
}

/** Switch between companies, or close back to the No Company Open list (Odoo-style). */
export function CompanySwitcher({
  companies,
  allowCreate = false,
  allowClose = false,
}: {
  companies: CompanyOption[]
  allowCreate?: boolean
  /** Show Close company → /databases (system owner / Connect). */
  allowClose?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { update } = useSession()
  const [busyId, setBusyId] = useState<string | null>(null)
  const current = companies.find((c) => c.isCurrent) ?? companies[0]
  const onDatabases = pathname === '/databases' || pathname.startsWith('/databases/')

  const open = async (orgId: string) => {
    if (orgId === current?.id && !onDatabases) {
      router.push('/dashboard')
      return
    }
    setBusyId(orgId)
    try {
      if (orgId !== current?.id) await update({ orgId })
      router.refresh()
      router.push('/dashboard')
    } catch {
      toast.error('Could not open that company.')
    } finally {
      setBusyId(null)
    }
  }

  if (companies.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 max-w-[12rem] gap-1 px-2 text-xs font-medium"
          aria-label="Switch company"
        >
          <Building2Icon className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{current?.name ?? 'Company'}</span>
          <ChevronsUpDownIcon className="size-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Your companies
        </DropdownMenuLabel>
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            disabled={busyId === company.id}
            onSelect={() => open(company.id)}
            className="gap-2"
          >
            <span className="min-w-0 flex-1 truncate">{company.name}</span>
            {company.isCurrent && !onDatabases ? (
              <CheckIcon className="size-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {allowClose || allowCreate ? (
          <>
            <DropdownMenuSeparator />
            {allowClose && !onDatabases ? (
              <DropdownMenuItem asChild>
                <Link href="/databases">
                  <DatabaseIcon />
                  Close company
                </Link>
              </DropdownMenuItem>
            ) : null}
            {allowCreate ? (
              <DropdownMenuItem asChild>
                <Link href="/databases?create=1">
                  <PlusIcon />
                  Create or import company
                </Link>
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
