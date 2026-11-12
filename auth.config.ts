import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-safe half of the auth configuration: no Prisma, no bcrypt, no Node APIs.
 * `middleware.ts` instantiates NextAuth with only this, which is what keeps the
 * middleware bundle small enough to run on the edge runtime.
 *
 * The authoritative permission check happens in `requireOrgContext()` on the Node
 * runtime, where the membership row is reachable. Middleware only redirects
 * (ADR-0007).
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60,
  },
  // Required behind Vercel / reverse proxies. Prefer setting APP_URL / AUTH_URL
  // in production so Auth.js has a canonical host; do not expose the app
  // without a trusted proxy that rewrites Host.
  trustHost: true,
  providers: [], // supplied in auth.ts — credentials needs the database
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl

      // APIs: never HTML-redirect. Public machine routes are allow-listed in
      // `isPublicApiPath`; session APIs get JSON 401 from `proxy.ts` when anonymous.
      // Handlers still enforce requireOrgContext / API-key / device / cron auth.
      if (pathname.startsWith('/api/')) return true

      // Public product + auth doors (no session). `/register` is self-serve company create.
      // Customer portal login + invite accept are public; authenticated `/portal` stays gated.
      const isPublic =
        pathname === '/' ||
        pathname === '/sign-in' ||
        pathname.startsWith('/login') ||
        pathname === '/setup' ||
        pathname === '/register' ||
        pathname === '/portal/login' ||
        pathname === '/portal/accept' ||
        pathname.startsWith('/sign-request/')
      if (isPublic) return true

      return Boolean(auth?.user)
    },
  },
} satisfies NextAuthConfig
