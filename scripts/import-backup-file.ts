/**
 * Import / restore company backups from disk — for files too large for the browser
 * (45 MB–500 MB+). Reads the JSON path directly; no HTTP upload.
 *
 * Usage:
 *   pnpm backup:from-file -- list --file "C:\Users\...\databases-backup-2026-11-26.json"
 *   pnpm backup:from-file -- import --file "C:\Users\...\al-furaat-materials-backup-….json"
 *   pnpm backup:from-file -- import --file "…\databases-backup-….json" --name "BLUE PLASTIC CENTER"
 *   pnpm backup:from-file -- restore --file "…\company-backup-….json" --confirm-name "AL FURAAT MATERIALS"
 *
 * Large JSON (e.g. 500 MB): set more heap before running:
 *   set NODE_OPTIONS=--max-old-space-size=8192
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  process.loadEnvFile('.env')
} catch {
  /* optional */
}

import { companiesFromParsed, type CompanyBackup } from '@/lib/backup-format'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { db } from '@/server/db'
import { importMissingCompanies } from '@/server/services/backup-import.service'
import { replaceCompanyFromBackup } from '@/server/services/backup-restore.service'

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return null
  const value = process.argv[idx + 1]
  if (!value || value.startsWith('--')) return null
  return value
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function usage(): never {
  console.error(`Usage:
  pnpm backup:from-file -- list    --file <path.json>
  pnpm backup:from-file -- import  --file <path.json> [--name "Company"] [--all-missing]
  pnpm backup:from-file -- restore --file <path.json> --confirm-name "Exact Company Name" [--org-id <id>]

Tips:
  - Prefer a single-company file when possible.
  - For ~500 MB:  set NODE_OPTIONS=--max-old-space-size=8192
  - restore replaces live books for that company (system owner only).`)
  process.exit(1)
}

async function systemOwnerCtx(orgId: string): Promise<OrgContext> {
  const owner = await db.user.findFirst({
    where: { isSystemOwner: true },
    select: { id: true, name: true, email: true, image: true, isSystemOwner: true },
  })
  if (!owner) throw new Error('No system owner user in the database.')

  const organization = await db.organization.findUniqueOrThrow({ where: { id: orgId } })
  const { logoStorageKey, ...orgFields } = organization

  return {
    orgId,
    userId: owner.id,
    role: 'OWNER',
    permissions: permissionsFor('OWNER'),
    isSystemOwner: true,
    canConnect: true,
    portalCustomerId: null,
    features: { ...DEFAULT_FEATURE_FLAGS },
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      image: owner.image,
      loginAt: Date.now(),
      hasDeskPin: false,
    },
  }
}

function loadCompanies(filePath: string) {
  const abs = resolve(filePath)
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`)
  const sizeMb = Math.round(statSync(abs).size / (1024 * 1024))
  console.log(`Reading ${abs} (~${sizeMb} MB)…`)
  if (sizeMb >= 200) {
    console.log('Large file — ensure NODE_OPTIONS=--max-old-space-size=8192 if this crashes.')
  }
  const text = readFileSync(abs, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not parse JSON.')
  }
  const companies = companiesFromParsed(parsed, abs)
  if (companies.length === 0) throw new Error('Not a SOM ERP backup.')
  return { abs, text, companies }
}

async function main() {
  const mode = process.argv[2]
  if (!mode || mode === '--help' || mode === '-h') usage()

  const file = arg('file')
  if (!file) usage()

  if (mode === 'list') {
    const { companies } = loadCompanies(file)
    for (const row of companies) {
      console.log(
        `- ${row.name}  id=${row.organizationId}  takenAt=${row.takenAt ?? 'n/a'}  key=${row.key}`,
      )
    }
    console.log(`Total: ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`)
    return
  }

  if (mode === 'import') {
    const { abs, text, companies } = loadCompanies(file)
    const nameFilter = arg('name')?.trim().toLowerCase() ?? null
    const wantAll = hasFlag('all-missing')

    const anchor =
      (await db.organization.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })) ??
      null
    if (!anchor) throw new Error('No organisation in DB yet — complete /setup first.')

    const ctx = await systemOwnerCtx(anchor.id)
    const files = [{ name: abs, text }]
    const { inspectBackupFiles } = await import('@/server/services/backup-import.service')
    const rows = await inspectBackupFiles(files)
    const missing = rows.filter((r) => r.status === 'missing')
    let keys = missing.map((r) => r.key)

    if (nameFilter) {
      keys = missing
        .filter((r) => r.name.trim().toLowerCase() === nameFilter)
        .map((r) => r.key)
      if (keys.length === 0) {
        const present = rows.find((r) => r.name.trim().toLowerCase() === nameFilter)
        if (present?.status === 'present') {
          throw new Error(
            `"${present.name}" already exists. Use: pnpm backup:from-file -- restore --file … --confirm-name "${present.name}"`,
          )
        }
        throw new Error(`No missing company named "${arg('name')}" in this file.`)
      }
    } else if (!wantAll) {
      if (companies.length > 1 && missing.length > 1) {
        console.log('Multiple missing companies. Re-run with --name "…" or --all-missing:')
        for (const row of missing) console.log(`  - ${row.name}`)
        process.exit(1)
      }
    }

    if (keys.length === 0) {
      console.log('Nothing to import — every company in the file is already present.')
      console.log('Use restore to replace an existing company from backup.')
      return
    }

    console.log(`Importing ${keys.length} compan${keys.length === 1 ? 'y' : 'ies'}…`)
    const result = await importMissingCompanies(ctx, files, keys)
    for (const row of result.imported) {
      console.log(`Imported: ${row.name} → orgId=${row.orgId}`)
    }
    if (result.skipped.length) console.log(`Skipped: ${result.skipped.length}`)
    return
  }

  if (mode === 'restore') {
    const confirmName = arg('confirm-name')
    if (!confirmName) {
      console.error('--confirm-name is required for restore (exact live company name).')
      usage()
    }
    const { abs, companies } = loadCompanies(file)
    const orgIdArg = arg('org-id')
    const nameLower = confirmName.trim().toLowerCase()

    let chosen = companies.find((c) => c.name.trim().toLowerCase() === nameLower) ?? null
    if (!chosen && companies.length === 1) chosen = companies[0]!
    if (!chosen) {
      console.error('Company not found in backup. Available:')
      for (const c of companies) console.error(`  - ${c.name}`)
      process.exit(1)
    }

    const target =
      (orgIdArg
        ? await db.organization.findUnique({ where: { id: orgIdArg } })
        : await db.organization.findFirst({
            where: { name: { equals: confirmName, mode: 'insensitive' } },
          })) ?? null
    if (!target) throw new Error(`Live company not found: ${confirmName}`)

    const ctx = await systemOwnerCtx(target.id)
    console.log(
      `RESTORE will wipe live books for "${target.name}" (${target.id}) and reload from backup takenAt=${chosen.takenAt ?? 'n/a'}`,
    )
    if (!hasFlag('yes')) {
      console.error('Add --yes to confirm. Aborting.')
      process.exit(1)
    }

    const result = await replaceCompanyFromBackup(ctx, {
      targetOrgId: target.id,
      confirmName: target.name,
      backup: chosen.payload as CompanyBackup,
    })
    console.log(`Restored: ${result.name} (orgId=${result.orgId}) takenAt=${result.takenAt}`)
    console.log(`Source file: ${abs}`)
    return
  }

  usage()
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
