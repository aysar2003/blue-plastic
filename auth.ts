import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { z } from 'zod'

import { authConfig } from '@/auth.config'
import { homeCompanyId, sessionCompanyId } from '@/lib/company-access'
import { db } from '@/server/db'
import { loadCompanyAccess } from '@/server/auth/company-access'
import { fakeVerify, verifyPassword } from '@/server/auth/password'
import { recordEvent } from '@/server/audit'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // The secret is read from AUTH_SECRET by Auth.js itself. Passing it here would
  // resolve `env` while this module is evaluated, which happens during
  // `next build` — see the note in lib/env.ts.
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const email = parsed.data.email.trim().toLowerCase()
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            homeOrgId: true,
            memberships: {
              where: { status: 'ACTIVE' },
              select: { orgId: true, role: true, version: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        // Equalise timing whether or not the account exists, so the response
        // does not enumerate registered addresses.
        if (!user?.passwordHash) {
          await fakeVerify()
          return null
        }

        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
          const membership = user.memberships[0]
          if (membership) {
            await recordEvent({
              orgId: membership.orgId,
              actorId: user.id,
              entity: 'User',
              entityId: user.id,
              action: 'LOGIN_FAILED',
            })
          }
          return null
        }

        // Staff land in the company they work for. The system owner does too,
        // and opens the others afterwards from the Databases app.
        const homeId = homeCompanyId(user.homeOrgId, user.memberships)
        const membership = user.memberships.find((row) => row.orgId === homeId)
        if (!membership) return null

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        await recordEvent({
          orgId: membership.orgId,
          actorId: user.id,
          entity: 'User',
          entityId: user.id,
          action: 'LOGIN',
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          orgId: membership.orgId,
          role: membership.role,
          membershipVersion: membership.version,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id
        token.orgId = user.orgId
        token.role = user.role
        token.membershipVersion = user.membershipVersion
      }

      // Refresh the claims when the client calls `useSession().update()` — used
      // after a role change or switching organisation so they need not sign out.
      if (trigger === 'update' && token.sub) {
        const access = await loadCompanyAccess(token.sub)
        if (access) {
          const requested =
            session && typeof session === 'object' && 'orgId' in session && typeof session.orgId === 'string'
              ? session.orgId
              : (token.orgId as string)
          const nextOrgId = sessionCompanyId({
            isSystemOwner: access.isSystemOwner,
            maySwitch: access.maySwitch,
            sessionOrgId: requested,
            homeOrgId: access.homeOrgId,
            memberships: access.memberships,
          })
          const membership = nextOrgId
            ? access.memberships.find((row) => row.orgId === nextOrgId)
            : undefined
          if (membership) {
            token.orgId = membership.orgId
            token.role = membership.role
            token.membershipVersion = membership.version
          } else if (access.isSystemOwner && nextOrgId) {
            const org = await db.organization.findUnique({
              where: { id: nextOrgId },
              select: { id: true },
            })
            if (org) {
              token.orgId = org.id
              token.role = 'OWNER'
              token.membershipVersion = 0
            }
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      session.user.orgId = token.orgId as string
      session.user.role = token.role as typeof session.user.role
      session.user.membershipVersion = token.membershipVersion as number
      return session
    },
  },
})
