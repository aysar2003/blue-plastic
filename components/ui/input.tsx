import * as React from 'react'

import { filterByKind, inferInputKind, type InputKind } from '@/lib/input-guards'
import { settleNumberInput } from '@/lib/money'
import { cn } from '@/lib/utils'

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } })
    ._valueTracker
  tracker?.setValue(input.value)
  setter?.call(input, value)
}

function writeInputValue(input: HTMLInputElement, value: string) {
  setNativeValue(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

type InputProps = React.ComponentProps<'input'> & {
  /**
   * When set, forces the typing filter. Otherwise inferred from inputMode /
   * type / name (decimal, account code, phone, …).
   */
  inputKind?: InputKind
}

function Input({
  className,
  type,
  inputMode,
  inputKind,
  onBlur,
  onChange,
  onPaste,
  readOnly,
  disabled,
  name,
  id,
  autoComplete,
  ...props
}: InputProps) {
  const kind = inferInputKind({
    inputMode: inputMode ?? null,
    type: type ?? null,
    name: name ?? null,
    id: id ?? null,
    inputKind: inputKind ?? null,
  })

  const guardValue = (raw: string) => (kind ? filterByKind(kind, raw) : raw)
  const lockComplete =
    kind === 'decimal' || kind === 'integer' || kind === 'account-code' ? 'off' : autoComplete

  return (
    <input
      type={type}
      inputMode={inputMode}
      name={name}
      id={id}
      readOnly={readOnly}
      disabled={disabled}
      autoComplete={lockComplete}
      spellCheck={
        kind === 'decimal' || kind === 'integer' || kind === 'account-code' || kind === 'phone'
          ? false
          : undefined
      }
      data-slot="input"
      data-input-kind={kind ?? undefined}
      onChange={(event) => {
        if (!readOnly && !disabled && kind) {
          const next = guardValue(event.currentTarget.value)
          if (next !== event.currentTarget.value) {
            setNativeValue(event.currentTarget, next)
          }
        }
        onChange?.(event)
      }}
      onPaste={(event) => {
        if (!readOnly && !disabled && kind) {
          const text = event.clipboardData.getData('text')
          const input = event.currentTarget
          const start = input.selectionStart ?? input.value.length
          const end = input.selectionEnd ?? input.value.length
          const merged = guardValue(input.value.slice(0, start) + text + input.value.slice(end))
          event.preventDefault()
          setNativeValue(input, merged)
          onChange?.({
            ...event,
            currentTarget: input,
            target: input,
          } as React.ChangeEvent<HTMLInputElement>)
          const caret = Math.min(start + filterByKind(kind, text).length, merged.length)
          requestAnimationFrame(() => {
            try {
              input.setSelectionRange(caret, caret)
            } catch {
              /* some input types refuse selection */
            }
          })
          return
        }
        onPaste?.(event)
      }}
      onBlur={(event) => {
        if (!readOnly && !disabled && (kind === 'decimal' || inputMode === 'decimal')) {
          const settled = settleNumberInput(event.currentTarget.value)
          if (settled !== null && settled !== event.currentTarget.value) {
            writeInputValue(event.currentTarget, settled)
          } else if (kind) {
            const cleaned = guardValue(event.currentTarget.value)
            if (cleaned !== event.currentTarget.value) {
              writeInputValue(event.currentTarget, cleaned)
            }
          }
        }
        onBlur?.(event)
      }}
      className={cn(
        'flex h-8 w-full min-w-0 rounded-md border border-input bg-card px-2.5 py-1 text-[0.8125rem] text-foreground transition-[color,box-shadow] outline-none',
        'file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground caret-foreground',
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
export type { InputProps }
