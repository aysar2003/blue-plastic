import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { canDeclineSignRequest, canSignRequest } from '@/lib/erp/sign-workflow'
import { isAppError } from '@/server/errors'
import * as collab from '@/server/services/collab.service'

import { declineRequest, signRequest } from './actions'

export const metadata: Metadata = { title: 'Sign document' }

export default async function PublicSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let row: Awaited<ReturnType<typeof collab.getSignRequestByToken>>
  try {
    row = await collab.getSignRequestByToken(token)
  } catch (error) {
    if (isAppError(error)) {
      return (
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-lg font-semibold">Signing link not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">Ask the sender for a new link.</p>
        </main>
      )
    }
    throw error
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <p className="text-muted-foreground text-sm">{row.organization.name}</p>
      <h1 className="mb-2 text-xl font-semibold">{row.title}</h1>
      <p className="text-muted-foreground mb-4 text-sm">Status: {row.status}</p>
      {row.message ? <p className="mb-4 text-sm">{row.message}</p> : null}
      {canSignRequest(row.status) ? (
        <Card className="space-y-3 p-4">
          <form action={signRequest} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <div>
              <Label htmlFor="signerName">Your name</Label>
              <Input
                id="signerName"
                name="signerName"
                defaultValue={row.signerName ?? ''}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="signatureData">Type your name to sign</Label>
              <Input id="signatureData" name="signatureData" required className="mt-1" />
            </div>
            <Button type="submit">Sign</Button>
          </form>
          {canDeclineSignRequest(row.status) ? (
            <form action={declineRequest} className="space-y-2 border-t pt-3">
              <input type="hidden" name="token" value={token} />
              <Input name="reason" placeholder="Reason (optional)" />
              <Button type="submit" variant="outline" size="sm">
                Decline
              </Button>
            </form>
          ) : null}
        </Card>
      ) : (
        <p className="text-sm">This request is {row.status.toLowerCase()}.</p>
      )}
    </main>
  )
}
