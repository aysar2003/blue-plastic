/** Prints whether UAT/E2E env is ready — never prints secret values. */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function load(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[t.slice(0, eq).trim()] = v
  }
  return out
}

const env = { ...load(resolve('.env')), ...load(resolve('.env.local')), ...process.env }
console.log(
  JSON.stringify(
    {
      hasDatabaseUrl: Boolean(env.DATABASE_URL),
      hasE2EEmail: Boolean(env.E2E_EMAIL),
      hasE2EPassword: Boolean(env.E2E_PASSWORD),
      e2eBaseUrl: env.E2E_BASE_URL || 'http://127.0.0.1:3000',
      hasAuthSecret: Boolean(env.AUTH_SECRET),
    },
    null,
    2,
  ),
)
