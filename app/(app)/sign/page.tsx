import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { canCancelSignRequest, canSignRequest } from '@/lib/erp/sign-workflow'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

import { cancelSignRequest, createSignRequest, emailSignRequest, markSigned } from './actions'

export const metadata: Metadata = { title: 'Sign' }

export default async function SignPage() {
  const ctx = await requireOrgContext('knowledge:read')
  const rows = await collab.listSignRequests(ctx)

  return (
    <>
      <PageHeader
        title="Sign"
        description="Send a signing link. The signer opens the public page, types their name, and the audit stays on this request."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/documents">Documents</Link>
          </Button>
        }
      />
      <Card className="mb-6 max-w-lg space-y-3 p-4">
        <form action={createSignRequest} className="space-y-3">
          <div>
            <Label htmlFor="title">Document title</Label>
            <Input id="title" name="title" placeholder="Supply contract" required className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="signerName">Signer</Label>
              <Input id="signerName" name="signerName" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="signerEmail">Email</Label>
              <Input id="signerEmail" name="signerEmail" type="email" className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="message">Note to signer</Label>
            <Input id="message" name="message" className="mt-1" />
          </div>
          <Button type="submit" size="sm">
            Send for signature
          </Button>
        </form>
      </Card>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{row.title}</span>
              <span className="text-muted-foreground">{row.status}</span>
            </div>
            {row.signerName || row.signerEmail ? (
              <p className="text-muted-foreground">
                {row.signerName}
                {row.signerEmail ? ` · ${row.signerEmail}` : ''}
              </p>
            ) : null}
            {row.status === 'SIGNED' ? (
              <p className="mt-1">
                <Link href={`/sign/${row.id}/certificate`} className="text-primary underline">
                  Certificate
                </Link>
              </p>
            ) : null}
            {row.publicPath ? (
              <p className="mt-1 flex flex-wrap items-center gap-3">
                <Link href={row.publicPath} className="text-primary underline">
                  Signing link
                </Link>
                {row.signerEmail ? (
                  <form action={emailSignRequest}>
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Email link
                    </Button>
                  </form>
                ) : null}
              </p>
            ) : null}
            {canSignRequest(row.status) ? (
              <form action={markSigned} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={row.id} />
                <Input name="signerName" placeholder="Signer name" required className="max-w-xs" />
                <Input name="signatureData" placeholder="Typed signature" required className="max-w-xs" />
                <Button type="submit" size="sm" variant="secondary">
                  Mark signed
                </Button>
              </form>
            ) : null}
            {canCancelSignRequest(row.status) ? (
              <form action={cancelSignRequest} className="mt-2">
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
