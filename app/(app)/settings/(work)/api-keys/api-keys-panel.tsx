'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createApiKey, revokeApiKey } from './actions'

type KeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  createdBy: { id: string; name: string; email: string }
}

export function ApiKeysPanel({
  keys,
  scopeOptions,
  canManage,
}: {
  keys: KeyRow[]
  scopeOptions: string[]
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(scopeOptions.slice(0, 2))
  const [freshToken, setFreshToken] = useState<string | null>(null)

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createApiKey({ name, scopes })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      setFreshToken(result.data.token)
      setName('')
      toast.success('API key created — copy the token now.')
    })
  }

  function onRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeApiKey({ id })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('API key revoked.')
    })
  }

  return (
    <div className="space-y-8">
      {freshToken ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">Copy this token now — it will not be shown again.</p>
          <code className="mt-2 block break-all rounded bg-background px-2 py-1.5 text-xs">
            {freshToken}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(freshToken)
              toast.success('Copied')
            }}
          >
            Copy
          </Button>
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={onCreate} className="space-y-4 rounded-md border p-4">
          <div>
            <h3 className="text-sm font-semibold">Create API key</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Use <code className="text-[11px]">Authorization: Bearer som_…</code> on{' '}
              <code className="text-[11px]">/api/v1/*</code>. OpenAPI:{' '}
              <code className="text-[11px]">/api/v1/openapi</code>.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Integration name"
              required
              maxLength={80}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Scopes</legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {scopeOptions.map((scope) => (
                <li key={scope}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <span className="font-mono text-xs">{scope}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <Button type="submit" disabled={pending || scopes.length === 0}>
            {pending ? 'Creating…' : 'Create key'}
          </Button>
        </form>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold">Keys</h3>
        {keys.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {key.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">{key.prefix}…</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {key.scopes.join(', ')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {key.createdAt.slice(0, 10)} by {key.createdBy.name}
                    {key.lastUsedAt ? ` · last used ${key.lastUsedAt.slice(0, 10)}` : ''}
                    {key.revokedAt ? ` · revoked ${key.revokedAt.slice(0, 10)}` : ''}
                  </p>
                </div>
                {canManage && !key.revokedAt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onRevoke(key.id)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
