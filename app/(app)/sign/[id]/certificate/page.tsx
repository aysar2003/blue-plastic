import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SIGN_CERTIFICATE_LEGAL, signCertificateReady, signatureDigest } from '@/lib/erp/sign-certificate'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

export const metadata: Metadata = { title: 'Sign certificate' }

export default async function SignCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('knowledge:read')
  const { id } = await params
  const row = await collab.getSignRequest(ctx, id)
  if (!signCertificateReady(row.status, row.signatureData)) notFound()
  const signedAt = row.signedAt?.toISOString() ?? ''
  const digest = signatureDigest({
    orgId: ctx.orgId,
    requestId: row.id,
    signatureData: row.signatureData ?? '',
    signedAt,
  })

  return (
    <article className="mx-auto max-w-xl space-y-4 rounded-md border bg-card p-8 print:border-0">
      <h1 className="text-xl font-semibold">Signature certificate</h1>
      <p className="text-sm text-muted-foreground">{SIGN_CERTIFICATE_LEGAL}</p>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Company</dt>
          <dd>{ctx.organization.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Document</dt>
          <dd>{row.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Signer</dt>
          <dd>{row.signerName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Signed at</dt>
          <dd>{signedAt || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Typed signature</dt>
          <dd className="font-medium">{row.signatureData}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">SHA-256 digest</dt>
          <dd className="break-all font-mono text-xs">{digest}</dd>
        </div>
      </dl>
    </article>
  )
}
