/**
 * Backup file shapes.
 *
 * v1 — one company (what Download has always written).
 * v2 — several companies in one file, for multi-database import.
 */

export type CompanyBackupOrg = {
  id: string
  name: string
  legalName?: string | null
  baseCurrency?: string
  [key: string]: unknown
}

export type CompanyBackup = {
  version: number
  takenAt?: string
  organization: CompanyBackupOrg
  memberships?: unknown[]
  [key: string]: unknown
}

export type BackupBundle = {
  version: 2
  takenAt: string
  databases: CompanyBackup[]
}

export type BackupCompanyRef = {
  /** Stable key inside this file / pick session. */
  key: string
  sourceLabel: string
  organizationId: string
  name: string
  legalName: string | null
  baseCurrency: string
  takenAt: string | null
  /** Full company payload for import. */
  payload: CompanyBackup
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Pull every company backup out of a parsed JSON value. */
export function companiesFromParsed(parsed: unknown, sourceLabel: string): BackupCompanyRef[] {
  if (!isRecord(parsed)) return []

  // v2 bundle
  if (parsed.version === 2 && Array.isArray(parsed.databases)) {
    return parsed.databases.flatMap((entry, index) => {
      if (!isRecord(entry) || !isRecord(entry.organization)) return []
      const org = entry.organization as CompanyBackupOrg
      if (typeof org.id !== 'string' || typeof org.name !== 'string') return []
      const payload = entry as CompanyBackup
      return [
        {
          key: `${sourceLabel}::${org.id}::${index}`,
          sourceLabel,
          organizationId: org.id,
          name: org.name,
          legalName: typeof org.legalName === 'string' ? org.legalName : null,
          baseCurrency: typeof org.baseCurrency === 'string' ? org.baseCurrency : 'USD',
          takenAt: typeof payload.takenAt === 'string' ? payload.takenAt : null,
          payload,
        },
      ]
    })
  }

  // v1 single company
  if (isRecord(parsed.organization)) {
    const org = parsed.organization as CompanyBackupOrg
    if (typeof org.id !== 'string' || typeof org.name !== 'string') return []
    const payload = parsed as CompanyBackup
    return [
      {
        key: `${sourceLabel}::${org.id}`,
        sourceLabel,
        organizationId: org.id,
        name: org.name,
        legalName: typeof org.legalName === 'string' ? org.legalName : null,
        baseCurrency: typeof org.baseCurrency === 'string' ? org.baseCurrency : 'USD',
        takenAt: typeof payload.takenAt === 'string' ? payload.takenAt : null,
        payload,
      },
    ]
  }

  return []
}

export function makeBundle(databases: CompanyBackup[]): BackupBundle {
  return {
    version: 2,
    takenAt: new Date().toISOString(),
    databases,
  }
}
