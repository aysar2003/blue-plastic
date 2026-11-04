export const SIGN_STATUSES = ['DRAFT', 'SENT', 'SIGNED', 'DECLINED', 'CANCELLED'] as const
export type SignStatus = (typeof SIGN_STATUSES)[number]

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
