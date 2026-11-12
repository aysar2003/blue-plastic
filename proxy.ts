import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

import { authConfig } from '@/auth.config'
import { isPublicApiPath } from '@/lib/public-api'

/**
 * Next.js 16 network proxy (formerly `middleware.ts`).
 *
 * Instantiated from the edge-safe config only — no Prisma, no bcrypt — which is
 * what keeps this bundle inside the proxy runtime's limits. It is a redirect
 * convenience for signed-out users, never a security boundary for permissions:
 * the authoritative check is `requireOrgContext()` in the service layer
 * (ADR-0007). Session-backed `/api/*` routes get a JSON 401 here when anonymous.
 */
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  if (pathname.startsWith('/api/') && !isPublicApiPath(pathname) && !req.auth?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } },
      { status: 401 },
    )
  }
})

export const config = {
  matcher: [
    // Everything except NextAuth endpoints, static assets and image files.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
