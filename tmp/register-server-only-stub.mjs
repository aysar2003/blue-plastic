import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stub = path.join(root, 'tests/stubs/server-only.ts')
const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return stub
  return orig.call(this, request, parent, isMain, options)
}
