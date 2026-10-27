'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import type { AccountType } from '@prisma/client'
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react'

import { AccountTypeIcon } from '@/components/accounts/account-type-icon'
import { focusNextField } from '@/lib/keyboard'
import { cn } from '@/lib/utils'

/**
 * A record picker that is a text box.
 *
 * The control *is* the input: click it and type. There is no separate search
 * field inside a popup — a second box to find your way to is a step, and this is
 * the most-used control in the application. What the user sees is what they type
 * into, and the list underneath narrows as they go.
 *
 * When nothing matches, creating the record is the *first* row rather than the
 * last: at that point it is the only thing left to do, so it belongs under the
 * cursor and not below a list of near-misses.
 *
 * Written by hand rather than pulled from a library because the useful behaviour
 * when a record is missing is to create it without leaving the form — which makes
 * this application logic, not a generic widget. See ADR-0012.
 *
 * Keyboard behaviour is the point of it, so it is explicit: type to filter, ↑/↓
 * to move, Enter to choose, Escape to close and restore, Tab to take the
 * highlighted match and move on, Backspace on an empty box to clear the selection.
 */
export type ComboboxOption = {
  value: string
  label: string
  /** Shown on the right, and searched as well — an account code, a balance. */
  hint?: string
  disabled?: boolean
  group?: string
  /** Chart-of-accounts type mark, when the option is an account. */
  accountType?: AccountType
}

export type ComboboxProps = {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  name?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  clearable?: boolean
  /**
   * Offered when the typed text matches nothing. The caller decides what
   * creating means — here it opens that record's own dialog — so this only
   * hands over the typed text.
   */
  onCreate?: (label: string) => void
  createLabel?: (label: string) => string
}

const normalise = (value: string) => value.toLowerCase().normalize('NFKD')

/**
 * A few letters should land on the name that starts with them. "ca" means Cash,
 * not an account that merely contains those letters later on.
 */
function matchScore(option: ComboboxOption, needle: string): number {
  const label = normalise(option.label)
  const hint = option.hint ? normalise(option.hint) : ''
  const parts = label.split(' — ')
  const code = parts.length > 1 ? parts[0]! : ''
  const name = parts.length > 1 ? parts.slice(1).join(' — ') : label
  const words = name.split(/[\s/]+/)

  if (label.startsWith(needle) || code.startsWith(needle) || name.startsWith(needle)) return 0
  if (words.some((word) => word.startsWith(needle))) return 1
  if (hint.startsWith(needle)) return 2
  return 3
}

type Row = { kind: 'option'; option: ComboboxOption } | { kind: 'create' }

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'Nothing found.',
  disabled,
  required,
  className,
  id,
  name,
  clearable,
  onCreate,
  createLabel = (label) => `Add “${label}”`,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value) ?? null

  const filtered = React.useMemo(() => {
    const needle = normalise(query.trim())
    if (!needle) return options
    // Opening with the current choice still in the box must show every option —
    // otherwise Deposit to / account pickers look locked to one bank.
    if (selected && normalise(selected.label) === needle) return options
    return options
      .map((option, index) => ({ option, index }))
      .filter(
        ({ option }) =>
          normalise(option.label).includes(needle) ||
          (option.hint ? normalise(option.hint).includes(needle) : false),
      )
      .sort(
        (a, b) => matchScore(a.option, needle) - matchScore(b.option, needle) || a.index - b.index,
      )
      .map(({ option }) => option)
  }, [options, query, selected])

  const canCreate =
    Boolean(onCreate) &&
    query.trim().length > 0 &&
    !options.some((option) => normalise(option.label) === normalise(query.trim()))

  // Create first, then the matches. One flat list, so the arrow keys and the
  // click handlers cannot disagree about what is highlighted.
  const rows: Row[] = [
    ...(canCreate ? [{ kind: 'create' as const }] : []),
    ...filtered
      .filter((option) => !option.disabled)
      .map((option) => ({ kind: 'option' as const, option })),
  ]

  /**
   * The list is rendered into the body, not next to the input. Every line table
   * in this application scrolls horizontally inside `overflow-x-auto` within an
   * `overflow-hidden` card, which would clip the list exactly where the picker
   * matters most — on an invoice line.
   */
  const [anchor, setAnchor] = React.useState<{
    top: number
    left: number
    width: number
    above: boolean
  }>()

  const place = React.useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return

    const below = window.innerHeight - rect.bottom
    const above = below < 280 && rect.top > below
    // The box on the form is often a narrow column (e.g. inside a dialog). The
    // list must be wide enough for long customer names to wrap and read in full.
    const width = Math.min(Math.max(rect.width, 520), window.innerWidth - 16)
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
    const next = {
      top: above ? rect.top - 4 : rect.bottom + 4,
      left,
      width,
      above,
    }

    setAnchor((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.above === next.above
        ? prev
        : next,
    )
  }, [])

  function close(refocus = true) {
    setOpen(false)
    // Always clear the search box. When a value is chosen the closed field shows
    // the option label; when nothing is chosen an empty box must stay empty —
    // leaving typed-but-unchosen text looks like a registered pick and has
    // posted sales with no itemId (Uncategorised Income, no stock).
    setQuery('')
    if (refocus) {
      // Keep focus on this control after the list closes — never drop to <body>,
      // or the next Tab starts again at the top of the form.
      queueMicrotask(() => inputRef.current?.focus())
    }
  }

  /** Accept a row, then move to the next field (Enter / Tab) or stay put (click). */
  function choose(row: Row, advance: 0 | 1 | -1 = 0) {
    if (row.kind === 'option') {
      onChange(row.option.value)
      setOpen(false)
      setQuery('')
      queueMicrotask(() => {
        const input = inputRef.current
        if (!input) return
        if (advance !== 0) focusNextField(input, advance)
        else input.focus()
      })
      return
    }

    if (!onCreate) return
    const label = query.trim()
    setOpen(false)
    setQuery('')
    onCreate(label)
  }

  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close(false)
    }

    // Any scroll moves the input, so the list has to move with it — capture,
    // because the scroll is usually on an ancestor rather than on the window.
    // Ignore the list's own scroll or choosing a row jumps the panel and the
    // click never lands.
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return
      place()
    }

    place()
    inputRef.current?.focus()
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const needle = normalise(query.trim())
  const showingAll =
    !needle || (selected != null && normalise(selected.label) === needle)

  // Reset the highlight when the list changes, during render rather than in an
  // effect — an effect would paint the stale highlight once before correcting it.
  const listKey = `${open}|${query}`
  const [lastListKey, setLastListKey] = React.useState(listKey)
  if (listKey !== lastListKey) {
    setLastListKey(listKey)
    // Reopening a chosen name shows the whole list. Land on that row so the
    // list does not jump back to the first name.
    const selectedIndex = showingAll
      ? rows.findIndex((row) => row.kind === 'option' && row.option.value === value)
      : -1
    if (selectedIndex >= 0) {
      setActive(selectedIndex)
    } else {
      // The match is the default, not "Add …", so Tab takes the name they started.
      const preferred = rows.findIndex((row) => row.kind === 'option')
      setActive(preferred < 0 ? 0 : preferred)
    }
  }

  const keyboardNav = React.useRef(false)
  React.useEffect(() => {
    if (!open || !keyboardNav.current) return
    keyboardNav.current = false
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  React.useLayoutEffect(() => {
    if (!open || !value || !showingAll) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, value, showingAll, rows.length])

  function openList() {
    if (disabled || open) return
    // Seed with the chosen name (or leave what they already typed). Never clear
    // on focus — they delete characters themselves when they want a new search.
    setQuery((current) => (current.trim() ? current : (selected?.label ?? '')))
    setOpen(true)
    // Select the seeded label so the next keystroke replaces it and filters,
    // while the full list stays visible until they type.
    queueMicrotask(() => inputRef.current?.select())
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        openList()
      } else if (event.key === 'Enter') {
        // On a document line, Enter advances like a grid when a name is already set.
        if (value && inputRef.current && focusNextField(inputRef.current, 1)) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        openList()
      } else if (event.key === 'Backspace' && value && query === '') {
        onChange(null)
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setQuery(event.key)
        setOpen(true)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      keyboardNav.current = true
      setActive((index) => Math.min(index + 1, rows.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      keyboardNav.current = true
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[active]
      if (row) choose(row, 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      // Typed letters + Tab → take the highlighted match. Bare Tab through an
      // already-chosen name keeps it. Always preventDefault so focus cannot fall
      // to the document start when the list closes.
      const direction: 1 | -1 = event.shiftKey ? -1 : 1
      const needle = query.trim()
      const highlighted = rows[active]
      const choice =
        highlighted?.kind === 'option'
          ? highlighted
          : rows.find((row) => row.kind === 'option')
      if (needle && choice?.kind === 'option') {
        event.preventDefault()
        choose(choice, direction)
        return
      }
      event.preventDefault()
      setOpen(false)
      setQuery('')
      queueMicrotask(() => {
        if (inputRef.current) focusNextField(inputRef.current, direction)
      })
    } else if (event.key === 'Backspace' && query === '' && value) {
      // Backspacing an empty box clears the selection, which is what every other
      // text field does and what makes this one feel like one.
      onChange(null)
    } else if (event.key === 'Home') {
      event.preventDefault()
      keyboardNav.current = true
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      keyboardNav.current = true
      setActive(rows.length - 1)
    }
  }

  let renderedGroup: string | undefined

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {/* The real value, so an uncontrolled <form> submission still carries it. */}
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}

      <div
        data-invalid={aria['aria-invalid'] ? 'true' : undefined}
        className={cn(
          'flex min-h-8 w-full items-stretch rounded-md border border-input bg-card transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          'data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected?.accountType && !open ? (
          <span className="grid place-items-center pl-1.5">
            <AccountTypeIcon type={selected.accountType} size="sm" />
          </span>
        ) : null}
        {/* Always an input — swapping to a button after pick drops focus and
            sends the next Tab back to the top of the form. */}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id ?? name ?? 'combobox'}-list`}
          aria-describedby={aria['aria-describedby']}
          aria-required={required}
          disabled={disabled}
          autoComplete="off"
          title={selected && !open ? selected.label : undefined}
          value={open || !selected ? query : selected.label}
          placeholder={placeholder}
          onChange={(event) => {
            if (!open) setOpen(true)
            setQuery(event.target.value)
            // Typing over a chosen name starts a new search — clear the pick so
            // the box shows what they type rather than snapping back to the label.
            if (selected && event.target.value !== selected.label) onChange(null)
          }}
          onFocus={openList}
          onClick={openList}
          onKeyDown={onKeyDown}
          className="h-8 min-w-0 flex-1 truncate bg-transparent px-2.5 text-[0.8125rem] outline-none placeholder:text-muted-foreground"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close the list' : 'Open the list'}
          onClick={() => (open ? close() : openList())}
          className="grid h-full w-8 shrink-0 place-items-center border-l text-muted-foreground"
        >
          <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && anchor
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: anchor.above ? undefined : anchor.top,
                bottom: anchor.above ? window.innerHeight - anchor.top : undefined,
                left: anchor.left,
                width: anchor.width,
              }}
              className={cn(
                'pointer-events-auto z-[60] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
                'animate-in fade-in-0 zoom-in-95',
              )}
            >
              <div
                ref={listRef}
                id={`${id ?? name ?? 'combobox'}-list`}
                role="listbox"
                className="max-h-72 overflow-y-auto p-1"
              >
                {rows.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
                ) : null}

                {rows.map((row, index) => {
                  if (row.kind === 'create') {
                    return (
                      <button
                        key="__create"
                        type="button"
                        data-active={index === active}
                        onPointerEnter={() => setActive(index)}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          choose(row, 0)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium text-primary',
                          index === active ? 'bg-accent' : '',
                        )}
                      >
                        <PlusIcon className="mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                          {createLabel(query.trim())}
                        </span>
                      </button>
                    )
                  }

                  const option = row.option
                  const heading = option.group && option.group !== renderedGroup ? option.group : null
                  if (heading) renderedGroup = option.group

                  return (
                    <React.Fragment key={option.value}>
                      {heading ? (
                        <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
                          {heading}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        data-active={index === active}
                        onPointerEnter={() => setActive(index)}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          choose(row, 0)
                        }}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-popover-foreground',
                          index === active ? 'bg-accent text-accent-foreground' : '',
                        )}
                      >
                        <CheckIcon
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            option.value === value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        {option.accountType ? (
                          <AccountTypeIcon type={option.accountType} size="sm" />
                        ) : null}
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                          <span className="block whitespace-normal break-words">{option.label}</span>
                          {option.hint ? (
                            <span
                              className={cn(
                                'mt-0.5 block whitespace-normal break-words text-xs',
                                index === active ? 'text-accent-foreground/80' : 'text-muted-foreground',
                              )}
                            >
                              {option.hint}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </React.Fragment>
                  )
                })}

                {clearable && value ? (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onChange(null)
                      close()
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="size-4 shrink-0" />
                    Clear selection
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
