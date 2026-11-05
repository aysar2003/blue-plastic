import { createHash } from 'node:crypto'

/** sha256 hex of the full token — unique lookup index on api_keys.tokenLookup. */
export function tokenLookup(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/** Short display prefix shown in Settings (full secret is never stored in plaintext). */
export function displayPrefix(token: string) {
  return token.slice(0, 12)
}
