export const SIGN_STATUSES = ['DRAFT', 'SENT', 'SIGNED', 'DECLINED', 'CANCELLED'] as const
export type SignStatus = (typeof SIGN_STATUSES)[number]

/** Default lifetime for a public signing link. */
export const SIGN_REQUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000

export function canSendSignRequest(status: SignStatus): boolean {
  return status === 'DRAFT'
}

export function canSignRequest(status: SignStatus): boolean {
  return status === 'DRAFT' || status === 'SENT'
}

export function canDeclineSignRequest(status: SignStatus): boolean {
  return status === 'SENT'
}

export function canCancelSignRequest(status: SignStatus): boolean {
  return status === 'DRAFT' || status === 'SENT'
}

export function publicSignPath(token: string): string {
  return `/sign-request/${encodeURIComponent(token)}`
}

/** True when the public link is past expiresAt (or createdAt + TTL when expiresAt is null). */
export function isSignRequestExpired(row: {
  expiresAt: Date | null
  createdAt: Date
  now?: Date
}): boolean {
  const now = row.now ?? new Date()
  const deadline = row.expiresAt ?? new Date(row.createdAt.getTime() + SIGN_REQUEST_TTL_MS)
  return deadline.getTime() <= now.getTime()
}
