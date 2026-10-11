'use client'

import * as React from 'react'

import { Combobox } from '@/components/ui/combobox'
import type { AccountPickerOption } from '@/lib/account-options'

/**
 * One control for choosing an account, used everywhere an account is chosen.
 *
 * It never shortens the list. The caller decides what belongs at the top by the
 * order it builds the options in (see `accountOptions`), and everything else
 * stays a keystroke away under its statement heading — so a business that keeps
 * petty cash in an "Other current asset" can still pay a bill out of it.
 *
 * Each row carries the account's kind on the right, and that text is searched as
 * well as displayed: typing "payable" finds the payables accounts whatever they
 * happen to be called.
 */
export function AccountPicker({
  options,
  value,
  onChange,
  name,
  id,
  placeholder = 'Search the chart of accounts',
  clearable,
  disabled,
  required,
  error,
  className,
}: {
  options: AccountPickerOption[]
  value: string | null
  onChange: (value: string | null) => void
  name?: string
  id?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  error?: string[]
  className?: string
}) {
  const rows = React.useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: option.label,
        hint: option.hint,
        group: option.group,
        accountType: option.type,
      })),
    [options],
  )

  return (
    <Combobox
      options={rows}
      value={value}
      onChange={onChange}
      name={name}
      id={id}
      placeholder={placeholder}
      emptyMessage="No account matches. Add it in the chart of accounts."
      clearable={clearable}
      disabled={disabled}
      required={required}
      aria-invalid={error?.length ? true : undefined}
      aria-describedby={error?.length ? `${name ?? id}-error` : undefined}
      className={className}
    />
  )
}
