import { createHash } from 'node:crypto'

/**
 * Company-issued audit certificate for a completed Sign request.
 * Not a qualified electronic signature (eIDAS QES) and not a DocuSign document.
 */

export const SIGN_CERTIFICATE_LEGAL =
  'Internal audit certificate for this company. It records who typed a signature and when. It is not a qualified electronic signature and is not a DocuSign instrument.'

export function signatureDigest(input: {
  orgId: string
  requestId: string
  signatureData: string
  signedAt: string
}): string {
  return createHash('sha256')
    .update(
      `${input.orgId}|${input.requestId}|${input.signatureData}|${input.signedAt}`,
      'utf8',
    )
    .digest('hex')
}

export function signCertificateReady(status: string, signatureData: string | null | undefined): boolean {
  return status === 'SIGNED' && Boolean(signatureData?.trim())
}
