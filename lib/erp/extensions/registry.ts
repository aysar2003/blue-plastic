export type TrustedExtension = {
  id: string
  title: string
  capabilities: string[]
  version: string
  requiredPermissions: string[]
}

/** First-party extension allowlist (Phase 60). */
export const TRUSTED_EXTENSIONS: readonly TrustedExtension[] = [
  {
    id: 'som.capabilities',
    title: 'ERP capabilities mirror',
    capabilities: ['machine.read'],
    version: '1.0.0',
    requiredPermissions: ['machine.read'],
  },
  {
    id: 'som.mcp',
    title: 'MCP tool bridge',
    capabilities: ['machine.read', 'machine.write'],
    version: '1.0.0',
    requiredPermissions: ['machine.read'],
  },
  {
    id: 'som.report-packs',
    title: 'Scheduled report packs',
    capabilities: ['report:read'],
    version: '1.0.0',
    requiredPermissions: ['report:read'],
  },
] as const

const BY_ID = new Map(TRUSTED_EXTENSIONS.map((row) => [row.id, row]))

export type OrgTrustedExtensionEntry = {
  id: string
  title?: string
  capabilities?: string[]
  version?: string
  requiredPermissions?: string[]
}

/** Parse `Organization.trustedExtensions` JSON allowlist. */
export function parseOrgTrustedExtensions(raw: unknown): OrgTrustedExtensionEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id.trim() : '',
      title: typeof row.title === 'string' ? row.title.trim() : undefined,
      capabilities: Array.isArray(row.capabilities)
        ? row.capabilities.filter((c): c is string => typeof c === 'string')
        : undefined,
      version: typeof row.version === 'string' ? row.version.trim() : undefined,
      requiredPermissions: Array.isArray(row.requiredPermissions)
        ? row.requiredPermissions.filter((c): c is string => typeof c === 'string')
        : undefined,
    }))
    .filter((row) => row.id.length > 0)
}

function extensionFromOrgEntry(entry: OrgTrustedExtensionEntry): TrustedExtension {
  return {
    id: entry.id,
    title: entry.title ?? entry.id,
    capabilities: entry.capabilities ?? [],
    version: entry.version ?? '1.0.0',
    requiredPermissions: entry.requiredPermissions ?? [],
  }
}

export function mergedTrustedExtensions(orgAllowlist: unknown): TrustedExtension[] {
  const merged = new Map<string, TrustedExtension>(BY_ID)
  for (const entry of parseOrgTrustedExtensions(orgAllowlist)) {
    if (!merged.has(entry.id)) {
      merged.set(entry.id, extensionFromOrgEntry(entry))
    }
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function assertTrustedExtension(id: string, orgAllowlist?: unknown): TrustedExtension {
  const key = id.trim()
  const builtIn = BY_ID.get(key)
  if (builtIn) return builtIn
  const orgRow = parseOrgTrustedExtensions(orgAllowlist).find((row) => row.id === key)
  if (orgRow) return extensionFromOrgEntry(orgRow)
  throw new Error(`Untrusted extension: ${id}`)
}

export function isTrustedExtension(id: string, orgAllowlist?: unknown): boolean {
  const key = id.trim()
  if (BY_ID.has(key)) return true
  return parseOrgTrustedExtensions(orgAllowlist).some((row) => row.id === key)
}

export function trustedExtensionIds(orgAllowlist?: unknown): string[] {
  return mergedTrustedExtensions(orgAllowlist).map((row) => row.id)
}