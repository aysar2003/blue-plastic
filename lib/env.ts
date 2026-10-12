import { z } from 'zod'

/**
 * Environment configuration, validated on first use rather than on import.
 *
 * Eager validation at module scope reads well but breaks the build: Next.js
 * evaluates every page module while collecting page data, so a missing secret
 * fails `next build` on any machine that legitimately has none — a fresh CI
 * checkout, or a Vercel project whose variables are set for runtime only.
 *
 * Laziness costs nothing in safety. The values are still validated before anyone
 * can read one, and a misconfigured deployment still fails loudly with the same
 * message — at the first request that needs a variable rather than at import.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Non-pooled connection used by migrations. Optional: only pooled providers need it.
  DIRECT_URL: z.string().optional(),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters — generate one with `openssl rand -base64 32`'),
  /**
   * Canonical HTTPS origin once a custom domain is attached, e.g. https://somerp.com.
   * Optional: Auth.js already trusts the request host (`trustHost: true`).
   */
  APP_URL: z.string().url().optional(),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

type Env = z.infer<typeof schema>

let cached: Env | undefined

function load(): Env {
  const parsed = schema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    APP_URL: process.env.APP_URL || undefined,
    AUTH_URL: process.env.AUTH_URL || undefined,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`)
  }

  return parsed.data
}

/** Reads like a plain object; validates the whole environment on the first property access. */
export const env: Env = new Proxy({} as Env, {
  get(_target, property: string) {
    cached ??= load()
    return cached[property as keyof Env]
  },
})
