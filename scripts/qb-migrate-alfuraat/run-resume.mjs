import Module from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

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
register('tsx/esm', pathToFileURL(path.join(root, 'package.json')))
const { main } = await import(pathToFileURL(path.join(__dirname, 'resume-bulk.ts')).href)
await main()
