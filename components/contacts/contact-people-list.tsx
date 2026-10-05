'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { setCustomersActive, setVendorsActive } from '@/app/(app)/customers/actions'
import {
  ContactPersonRow,
  type ContactMenuItem,
} from '@/components/contacts/contact-person-row'

const SHEET =
  'min-h-full bg-[linear-gradient(to_bottom,transparent_2.15rem,var(--border)_2.15rem,var(--border)_calc(2.15rem+1px))] bg-[length:100%_2.2rem]'

export type PeopleListRow = {
  id: string
  name: string
  balance: string
  active: boolean
  href: string
  doubleClickHref?: string
  menuLinks: { label: string; href: string }[]
}

/**
 * Left-hand name list: click to select, double-click QuickReport, … for every
 * related transaction (and make active / inactive when allowed).
 */
export function ContactPeopleList({
  side,
  people,
  selectedId,
  currency,
  canArchive,
}: {
  side: 'customer' | 'vendor'
  people: PeopleListRow[]
  selectedId?: string
  currency: string
  canArchive: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const toggleActive = (id: string, currentlyActive: boolean, name: string) => {
    if (isPending) return
    startTransition(async () => {
      const result =
        side === 'customer'
          ? await setCustomersActive({ ids: [id], isActive: !currentlyActive })
          : await setVendorsActive({ ids: [id], isActive: !currentlyActive })
      if (result.ok) {
        toast.success(currentlyActive ? `${name} made inactive.` : `${name} made active.`)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <div className={SHEET}>
      {people.map((person) => {
        const menu: ContactMenuItem[] = person.menuLinks.map((link) => ({
          type: 'link' as const,
          label: link.label,
          href: link.href,
        }))
        if (canArchive) {
          menu.push({ type: 'separator' })
          menu.push({
            type: 'action',
            label: person.active ? 'Make inactive' : 'Make active',
            destructive: person.active,
            onSelect: () => toggleActive(person.id, person.active, person.name),
          })
        }

        return (
          <ContactPersonRow
            key={person.id}
            href={person.href}
            selected={person.id === selectedId}
            name={person.name}
            balance={person.balance}
            currency={currency}
            active={person.active}
            doubleClickHref={person.doubleClickHref}
            menu={menu}
          />
        )
      })}
    </div>
  )
}
