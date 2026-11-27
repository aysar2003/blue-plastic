/**
 * Prints whether critical env vars exist — never prints secret values.
 * Usage: node scripts/env-health-check.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function hostOf(url) {
  if (!url) return null
  try {
    return new URL(url.replace(/^postgresql:/i, 'http:')).hostname
  } catch {
    return '(unparseable)'
  }
}

function providerHint(hostname) {
  if (!hostname) return null
  const h = hostname.toLowerCase()
  if (h.includes('supabase')) return 'supabase'
  if (h.includes('neon.tech') || h.includes('neon')) return 'neon'
  if (h.includes('amazonaws') || h.includes('rds.')) return 'aws-rds'
  if (h === 'localhost' || h === '127.0.0.1') return 'local'
  return 'other'
}

const root = resolve(process.cwd())
const env = {
  ...loadEnvFile(resolve(root, '.env')),
  ...loadEnvFile(resolve(root, '.env.local')),
}

const dbHost = hostOf(env.DATABASE_URL)
const directHost = hostOf(env.DIRECT_URL)

const report = {
  hasDatabaseUrl: Boolean(env.DATABASE_URL),
  hasDirectUrl: Boolean(env.DIRECT_URL),
  dbHost,
  directHost,
  dbProvider: providerHint(dbHost),
  hasAuthSecret: Boolean(env.AUTH_SECRET),
  hasAppUrl: Boolean(env.APP_URL),
  hasR2Account: Boolean(env.R2_ACCOUNT_ID),
  hasR2Key: Boolean(env.R2_ACCESS_KEY_ID),
  hasR2Secret: Boolean(env.R2_SECRET_ACCESS_KEY),
  hasR2Bucket: Boolean(env.R2_BUCKET),
  r2BucketName: env.R2_BUCKET ? String(env.R2_BUCKET) : null,
  readyForWeeklyJsonBackup: Boolean(env.DATABASE_URL || env.DIRECT_URL),
  readyForFileUploads: Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  ),
}

console.log(JSON.stringify(report, null, 2))
