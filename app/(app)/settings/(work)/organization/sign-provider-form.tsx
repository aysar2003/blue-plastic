'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseSignProvider } from '@/lib/erp/sign-provider'

import { updateSignProviderAction } from './sign-provider-actions'

export function SignProviderForm({
  signProvider,
  canEdit,
}: {
  signProvider: unknown
  canEdit: boolean
}) {
  const parsed = parseSignProvider(signProvider)
  const [kind, setKind] = useState(parsed.kind)
  const [webhookUrl, setWebhookUrl] = useState(parsed.webhookUrl ?? '')
  const [webhookSecret, setWebhookSecret] = useState(parsed.webhookSecret ?? '')
  const [pending, start] = useTransition()

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">Sign provider</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Native signing in-app, or POST to a webhook when a sign request is sent.
      </p>
      <div className="mt-3 grid max-w-md gap-3">
        <div>
          <Label htmlFor="sign-kind">Kind</Label>
          <select
            id="sign-kind"
            className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
            disabled={!canEdit || pending}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'native' | 'webhook')}
          >
            <option value="native">Native</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        {kind === 'webhook' ? (
          <>
            <div>
              <Label htmlFor="sign-webhook">Webhook URL</Label>
              <Input
                id="sign-webhook"
                value={webhookUrl}
                disabled={!canEdit || pending}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label htmlFor="sign-secret">Webhook secret (HMAC)</Label>
              <Input
                id="sign-secret"
                type="password"
                autoComplete="off"
                value={webhookSecret}
                disabled={!canEdit || pending}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Optional — signs with X-Som-Signature"
              />
            </div>
          </>
        ) : null}
        {canEdit ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await updateSignProviderAction({
                  kind,
                  webhookUrl: kind === 'webhook' ? webhookUrl : undefined,
                  webhookSecret: kind === 'webhook' ? webhookSecret : undefined,
                })
                if (result.ok) toast.success('Sign provider saved.')
                else toast.error(result.error ?? 'Could not save.')
              })
            }
          >
            Save sign provider
          </Button>
        ) : null}
      </div>
    </div>
  )
}