import type { Metadata } from 'next'
import Link from 'next/link'

import { capabilityPermissionUniverse } from '@/lib/erp/capabilities'
import { requireOrgContext } from '@/server/auth/context'
import * as apiKeyService from '@/server/services/api-key.service'

import { ApiKeysPanel } from './api-keys-panel'

export const metadata: Metadata = { title: 'API keys' }

export default async function ApiKeysSettingsPage() {
  const ctx = await requireOrgContext('org:read')
  const canManage = ctx.permissions.has('org:update')
  const keys = canManage || ctx.permissions.has('org:read')
    ? await apiKeyService.listKeys(ctx)
    : []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">API keys</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Machine access for integrations and AI agents against{' '}
          <span className="font-medium text-foreground">{ctx.organization.name}</span>. Keys call the
          same services as the UI — see{' '}
          <Link href="/api/v1/openapi" className="font-medium text-primary underline">
            OpenAPI
          </Link>
          .
        </p>
      </div>
      <ApiKeysPanel
        keys={keys}
        scopeOptions={capabilityPermissionUniverse()}
        canManage={canManage}
      />
    </div>
  )
}
