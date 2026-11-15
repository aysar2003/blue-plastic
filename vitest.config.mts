import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const nextServerEntry = fileURLToPath(new URL('./node_modules/next/server.js', import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: 'resolve-next-server-extension',
      // next-auth deep-imports `next/server` with no extension; Node ESM needs .js.
      resolveId(id) {
        if (id === 'next/server' || id.endsWith('/next/server')) return nextServerEntry
        return null
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Manual one-shot importers that wipe/rebuild a named org — never part of `pnpm test`.
    exclude: ['node_modules/**', '.next/**', 'scripts/qb-migrate-alfuraat/**'],
    setupFiles: ['./tests/setup.ts'],
    // Integration tests hold interactive transactions against a pooled remote
    // database; running files in parallel exhausts the pool rather than finding bugs.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Force Vite to resolve next-auth (and its bare `next/server` import) instead
    // of leaving it to Node ESM, which fails without the .js extension.
    server: {
      deps: {
        inline: ['next-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` throws outside the Next.js server bundle. Tests exercise the
      // server modules directly, so it is stubbed rather than worked around.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
      'next/server': nextServerEntry,
    },
  },
})
