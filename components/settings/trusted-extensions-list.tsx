import { mergedTrustedExtensions } from '@/lib/erp/extensions/registry'

export function TrustedExtensionsList({ trustedExtensions }: { trustedExtensions: unknown }) {
  const rows = mergedTrustedExtensions(trustedExtensions)
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">Trusted extensions</p>
      <p className="mt-1 text-sm text-muted-foreground">
        First-party registry plus your organisation allowlist. Read-only — contact support to add
        ids.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <p className="font-medium">{row.title}</p>
            <p className="text-muted-foreground">
              {row.id} · v{row.version}
            </p>
            {row.requiredPermissions.length > 0 ? (
              <p className="text-muted-foreground">Permissions: {row.requiredPermissions.join(', ')}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}