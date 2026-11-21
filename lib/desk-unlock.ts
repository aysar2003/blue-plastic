/** Desk idle-lock PIN — optional, separate from POS till PIN. */

export const DESK_PIN_LENGTHS = [4, 6, 8, 10] as const
export type DeskPinLength = (typeof DESK_PIN_LENGTHS)[number]

export const DESK_PIN_LENGTH_MESSAGE = 'Use 4, 6, 8, or 10 digits.'
export const DESK_PIN_WRONG = 'Wrong PIN.'
export const DESK_PIN_REQUIRED = 'Enter your screen PIN.'
export const DESK_PIN_NOT_SET = 'No screen PIN is set. Use your password, or set a PIN in Profile.'

export function isDeskPinLength(n: number): n is DeskPinLength {
  return (DESK_PIN_LENGTHS as readonly number[]).includes(n)
}

/** Digits only; length must be 4, 6, 8, or 10. */
export function isDeskPin(value: string): boolean {
  if (!/^\d+$/.test(value)) return false
  return isDeskPinLength(value.length)
}

export function normalizeDeskPin(value: string): string {
  return value.trim()
}
