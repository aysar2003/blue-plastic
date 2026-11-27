/**
 * Stub `server-only`, then run the large-file backup import/restore CLI.
 * Usage: pnpm backup:from-file -- list --file path.json
 */
import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const stub = path.join(root, 'tests/stubs/server-only.ts')

const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}

process.chdir(root)
await import(pathToFileURL(path.join(__dirname, 'import-backup-file.ts')).href)
