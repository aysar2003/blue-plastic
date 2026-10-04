/**
 * The keys that do work, rather than go somewhere.
 *
 * Save, add-line and list movement are the same on every screen, so the
 * handler can look for the button or the row instead of each form teaching
 * it a private shortcut.
 */

export function buttonLabel(button: HTMLButtonElement) {
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Click the first enabled button whose label matches, and say whether one did. */
export function clickButton(match: (label: string) => boolean) {
  const buttons = document.querySelectorAll('button')
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) continue
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') continue
    if (!match(buttonLabel(button))) continue
    button.click()
    return true
  }
  return false
}

/**
 * Ctrl+S saves and closes. Ctrl+Shift+S saves and opens a blank one.
 * A plain Save is the fallback on screens that only have one save button.
 */
export function saveFromKeyboard(shift: boolean) {
  if (shift) return clickButton((label) => label === 'Save and new')
  return (
    clickButton((label) => label === 'Save and close') || clickButton((label) => label === 'Save')
  )
}

export function addLineFromKeyboard() {
  return clickButton((label) => label === 'Add line' || label === 'Add lines')
}

/** Rows a person can open, in the order they appear on the page. */
export function listRows() {
  return [...document.querySelectorAll<HTMLElement>('main tbody [data-slot="table-row"]')].filter((row) =>
    row.querySelector('a[href]'),
  )
}

/** Move the highlight by one row and focus its link, so Enter opens it. */
export function moveListRow(delta: number) {
  const rows = listRows()
  if (rows.length === 0) return false
  const current = rows.findIndex((row) => row.dataset.kbCurrent === 'true')
  const next =
    current < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, current + delta))
  for (const row of rows) delete row.dataset.kbCurrent
  const row = rows[next]
  if (!row) return false
  row.dataset.kbCurrent = 'true'
  row.scrollIntoView({ block: 'nearest' })
  row.querySelector<HTMLAnchorElement>('a[href]')?.focus()
  return true
}

const SKIPPED_TYPES = new Set(['hidden', 'checkbox', 'radio', 'button', 'submit', 'file'])

function isFocusable(node: HTMLElement) {
  if (node.tabIndex < 0) return false
  if (node.getAttribute('aria-hidden') === 'true') return false
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
    if (node.disabled) return false
    if (node instanceof HTMLInputElement && SKIPPED_TYPES.has(node.type)) return false
  }
  if (node instanceof HTMLButtonElement && node.disabled) return false
  return true
}

/**
 * Enter on a document line moves to the next field, the way a bookkeeper
 * expects a grid to work. Comboboxes and date fields handle Enter themselves
 * and mark the event handled, so this leaves those alone.
 */
export function focusNextInGrid(from: HTMLElement) {
  const form = from.closest('form')
  if (!form || !from.closest('form table')) return false
  if (from.tagName === 'TEXTAREA' || from.tagName === 'BUTTON') return false
  if (from.closest('[aria-expanded="true"]')) return false

  const fields = [...form.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter(isFocusable)
  const index = fields.indexOf(from)
  const next = index >= 0 ? fields[index + 1] : undefined
  if (!next) return false
  next.focus()
  return true
}
