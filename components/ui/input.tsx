import * as React from 'react'

import { settleNumberInput } from '@/lib/money'
import { cn } from '@/lib/utils'

function writeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } })._valueTracker
  tracker?.setValue('')
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function Input({ className, type, inputMode, onBlur, readOnly, disabled, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      readOnly={readOnly}
      disabled={disabled}
      data-slot="input"
      onBlur={(event) => {
        if (!readOnly && !disabled && inputMode === 'decimal') {
          const settled = settleNumberInput(event.currentTarget.value)
          if (settled !== null && settled !== event.currentTarget.value) {
            writeInputValue(event.currentTarget, settled)
          }
        }
        onBlur?.(event)
      }}
      className={cn(
        'flex h-8 w-full min-w-0 rounded-md border border-input bg-card px-2.5 py-1 text-[0.8125rem] transition-[color,box-shadow] outline-none',
        'file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
