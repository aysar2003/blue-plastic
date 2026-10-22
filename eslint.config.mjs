import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', '.vercel/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  /**
   * Layering rule (docs/01-architecture.md §2). Presentational components must not
   * reach into the server layer: doing so drags Prisma into a client bundle, or —
   * worse — quietly works in a Server Component and breaks the day someone adds
   * `'use client'` to the file.
   *
   * The rule has no exceptions. Anything a component genuinely needs from the
   * server layer is either a type (allowed) or belongs in `lib/` — which is why
   * role labels live in `lib/roles.ts` and the permission matrix does not.
   */
  {
    files: ['components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/**', '@/server'],
              allowTypeImports: true,
              message:
                'Components must not import from server/. Pass data in as props, or import types only.',
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
