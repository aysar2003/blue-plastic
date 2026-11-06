/**
 * Stub server-only, then rebuild open-item customer AR from the QB export.
 * Usage: node --import tsx scripts/qb-migrate-alfuraat/run-rebuild-open-ar.mjs
 * Prefer: pnpm exec vitest run scripts/qb-migrate-alfuraat/rebuild-open-ar.test.ts --maxWorkers=1
 */
import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const stub = path.join(root, 'tests/stubs/server-only.ts')

const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}

process.chdir(root)
await import(pathToFileURL(path.join(__dirname, 'rebuild-open-ar.ts')).href)
