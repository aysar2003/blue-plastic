'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Combobox } from '@/components/ui/combobox'

/** Customer on a sales list. Other filters stay as they are when this changes. */
export function CustomerFilter({ customers }: { customers: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get('customer')

  return (
    <div className="w-56 shrink-0">
      <Combobox
        options={customers}
        value={value}
        clearable
        placeholder="Customer"
        emptyMessage="No customer with that name."
        aria-label="Customer"
        onChange={(next) => {
          const params = new URLSearchParams(searchParams.toString())
          if (next) params.set('customer', next)
          else params.delete('customer')
          params.delete('page')
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }}
      />
    </div>
  )
}
