/** Letters or numbers, at least 4, longer allowed. bcrypt input stays well under 72 bytes. */
export const CASHIER_PIN_MAX = 64
const CASHIER_PIN = new RegExp(`^[A-Za-z0-9]{4,${CASHIER_PIN_MAX}}$`)

export const CASHIER_PIN_MESSAGE = 'Use at least 4 letters or numbers.'
export const CASHIER_PIN_WRONG = 'That PIN is not correct.'
export const CASHIER_PIN_REQUIRED = "Enter this cashier's PIN before selling."

export function isCashierPin(value: string): boolean {
  return CASHIER_PIN.test(value)
}
