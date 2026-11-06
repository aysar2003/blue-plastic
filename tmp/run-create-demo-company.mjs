/**
 * Stub server-only, then create the demo company.
 * Usage: node tmp/run-create-demo-company.mjs
 */
import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const stub = path.join(root, 'tests/stubs/server-only.ts')

const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}

process.chdir(root)
register('tsx/esm', pathToFileURL(path.join(root, 'package.json')))

await import(pathToFileURL(path.join(__dirname, 'create-demo-company.ts')).href)
