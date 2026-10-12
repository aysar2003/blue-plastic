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
    signIn: '/sign-in',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60,
  },
  trustHost: true,
  providers: [], // supplied in auth.ts — credentials needs the database
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl

      // Route handlers enforce their own access and answer with a JSON error
      // envelope. Redirecting them to an HTML sign-in page would hand their
      // callers a document where they asked for data.
      if (pathname.startsWith('/api/')) return true

      // Public product + auth doors (no session). `/register` is self-serve company create.
      const isPublic =
        pathname === '/' ||
        pathname === '/sign-in' ||
        pathname === '/login' ||
        pathname === '/setup' ||
        pathname === '/register'
      if (isPublic) return true

      return Boolean(auth?.user)
    },
  },
} satisfies NextAuthConfig
