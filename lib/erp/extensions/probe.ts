import { ERP_CAPABILITIES } from '@/lib/erp/capabilities'
import {
  assertTrustedExtension,
  type TrustedExtension,
} from '@/lib/erp/extensions/registry'

export type CapabilityProbeRow = {
  id: string
  title: string
  description: string
  permission: string
  method: string
  path: string
  loop: string
}

export type ExtensionProbeResult = {
  trusted: boolean
  extension: TrustedExtension | null
  error?: string
  capabilities: CapabilityProbeRow[]
}

function catalogue(): CapabilityProbeRow[] {
  return ERP_CAPABILITIES.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    permission: c.permission,
    method: c.method,
    path: c.path,
    loop: c.loop,
  }))
}

/** Probe whether an extension id is trusted and list machine capabilities it may call. */
export function probeTrustedExtension(id: string, orgAllowlist?: unknown): ExtensionProbeResult {
  const key = id.trim()
  if (!key) {
    return {
      trusted: false,
      extension: null,
      error: 'Enter an extension id.',
      capabilities: [],
    }
  }
  try {
    const extension = assertTrustedExtension(key, orgAllowlist)
    const caps = catalogue()
    const permissionSet = new Set(extension.requiredPermissions)
    const capabilitySet = new Set(extension.capabilities)
    const filtered =
      permissionSet.size === 0 && capabilitySet.size === 0
        ? caps
        : caps.filter(
            (row) =>
              capabilitySet.has(row.id) ||
              capabilitySet.has(row.permission) ||
              capabilitySet.has('machine.read') ||
              capabilitySet.has('machine.write') ||
              permissionSet.has(row.permission),
          )
    return {
      trusted: true,
      extension,
      capabilities: filtered.length > 0 ? filtered : caps,
    }
  } catch (error) {
    return {
      trusted: false,
      extension: null,
      error: error instanceof Error ? error.message : `Untrusted extension: ${key}`,
      capabilities: [],
    }
  }
}
