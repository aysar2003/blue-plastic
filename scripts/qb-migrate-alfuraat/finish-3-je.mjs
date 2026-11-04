/**
 * Import only the 3 QB journals that failed on a DB blip.
 * Avoids loading User.dashboardPrefs (schema drift).
 */
process.loadEnvFile('.env')
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import Module from 'node:module'
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const stub = path.join(root, 'tests/stubs/server-only.ts')
const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}
process.chdir(root)
process.env.ALLOW_DB_TESTS ??= '1'
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long'

// Use vitest path instead — this file will be imported from a small vitest test.
console.log('Use finish-3-je.test.ts via vitest')
