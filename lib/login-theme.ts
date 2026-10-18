/** Preference for the public login doors only — does not change the books theme. */
export const LOGIN_DARK_KEY = 'bpc.loginDark'

export function parseLoginDark(raw: string | null | undefined): boolean {
  if (raw === '0' || raw === 'light') return false
  if (raw === '1' || raw === 'dark') return true
  // Default: dark (matches staff / hub).
  return true
}
