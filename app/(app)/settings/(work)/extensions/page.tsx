import type { Metadata } from 'next'
import Link from 'next/link'

import { TrustedExtensionsAllowlist } from '@/components/settings/trusted-extensions-allowlist'
import { probeTrustedExtension } from '@/lib/erp/extensions/probe'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Trusted extensions' }

export default async function ExtensionsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('org:read')
  const canEdit = ctx.permissions.has('org:update')
  const trustedExtensions = await organizationService.getTrustedExtensions(ctx)
  const params = await searchParams
  const extensionId = typeof params.extensionId === 'string' ? params.extensionId : ''
  const probe = extensionId ? probeTrustedExtension(extensionId, trustedExtensions) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Trusted extensions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisation allowlist plus a capability probe. Machine clients can also call{' '}
          <Link href="/api/v1/extensions/probe" className="text-primary underline-offset-4 hover:underline">
            GET /api/v1/extensions/probe
          </Link>
          .
        </p>
      </div>

      <TrustedExtensionsAllowlist trustedExtensions={trustedExtensions} canEdit={canEdit} />

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Capability probe</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter an extension id to see whether it is trusted and which machine capabilities it may
          call.
        </p>
        <form className="mt-3 flex max-w-md flex-wrap gap-2" method="get">
          <input
            name="extensionId"
            defaultValue={extensionId}
            placeholder="som.mcp"
            className="border-input bg-background h-9 min-w-48 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium"
          >
            Probe
          </button>
        </form>
        {probe ? (
          <div className="mt-4 space-y-2 text-sm">
            {probe.trusted && probe.extension ? (
              <>
                <p>
                  <span className="font-medium">{probe.extension.title}</span>{' '}
                  <span className="text-muted-foreground">
                    ({probe.extension.id} · v{probe.extension.version}) is trusted.
                  </span>
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {probe.capabilities.map((cap) => (
                    <li key={cap.id}>
                      <span className="text-foreground">{cap.id}</span> · {cap.method} {cap.path} ·{' '}
                      {cap.permission}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-destructive">{probe.error ?? 'Untrusted extension.'}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
