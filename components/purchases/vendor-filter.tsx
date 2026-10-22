'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Combobox } from '@/components/ui/combobox'

/** Vendor on a purchase list. Other filters stay as they are when this changes. */
export function VendorFilter({ vendors }: { vendors: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get('vendorId')

  return (
    <div className="w-56 shrink-0">
      <Combobox
        options={vendors}
        value={value}
        clearable
        placeholder="Vendor"
        emptyMessage="No vendor with that name."
        aria-label="Vendor"
        onChange={(next) => {
          const params = new URLSearchParams(searchParams.toString())
          if (next) params.set('vendorId', next)
          else params.delete('vendorId')
          params.delete('page')
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }}
      />
    </div>
  )
}
