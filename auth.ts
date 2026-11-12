import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { z } from 'zod'

import { authConfig } from '@/auth.config'
import { assertSignInRateLimit } from '@/lib/auth-rate-limit'
import { homeCompanyId, sessionCompanyId } from '@/lib/company-access'
import { parseLoginIdentifier } from '@/lib/phone'
import { db } from '@/server/db'
import { loadCompanyAccess } from '@/server/auth/company-access'
import { consumeLoginTicket } from '@/server/auth/login-ticket-store'
import { fakeVerify, verifyPassword } from '@/server/auth/password'
import { recordEvent } from '@/server/audit'
import { userNeedsTwoFactor } from '@/server/services/auth-2fa.service'

const passwordCredentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  loginTicket: z.string().optional(),
})

const ticketCredentialsSchema = z.object({
  loginTicket: z.string().min(1),
  email: z.string().optional(),
  password: z.string().optional(),
})

async function sessionUserFromId(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      homeOrgId: true,
      memberships: {
        where: { status: 'ACTIVE' },
        select: { orgId: true, role: true, version: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) return null

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
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // The secret is read from AUTH_SECRET by Auth.js itself. Passing it here would
  // resolve `env` while this module is evaluated, which happens during
  // `next build` — see the note in lib/env.ts.
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, loginTicket: {} },
      async authorize(raw) {
        const ticketParsed = ticketCredentialsSchema.safeParse(raw)
        if (ticketParsed.success && ticketParsed.data.loginTicket && !ticketParsed.data.password) {
          try {
            await assertSignInRateLimit(`ticket:${ticketParsed.data.loginTicket.slice(0, 24)}`)
          } catch {
            return null
          }
          const ticket = await consumeLoginTicket(ticketParsed.data.loginTicket)
          if (!ticket) return null
          return sessionUserFromId(ticket.userId)
        }

        const parsed = passwordCredentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        // Prefer a post-2FA ticket when both are present.
        if (parsed.data.loginTicket) {
          try {
            await assertSignInRateLimit(`ticket:${parsed.data.loginTicket.slice(0, 24)}`)
          } catch {
            return null
          }
          const ticket = await consumeLoginTicket(parsed.data.loginTicket)
          if (!ticket) return null
          return sessionUserFromId(ticket.userId)
        }

        const identifier = parseLoginIdentifier(parsed.data.email)
        if (!identifier) {
          await fakeVerify()
          return null
        }

        try {
          await assertSignInRateLimit(identifier.value)
        } catch {
          return null
        }

        const user = await db.user.findUnique({
          where: identifier.kind === 'email' ? { email: identifier.value } : { phone: identifier.value },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            homeOrgId: true,
            isSystemOwner: true,
            totpEnabledAt: true,
            otp2faEnabledAt: true,
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

        // Password alone must not create a session when 2FA is on (system owners always).
        if (userNeedsTwoFactor(user)) return null

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
              const previousOrgId = typeof token.orgId === 'string' ? token.orgId : null
              token.orgId = org.id
              token.role = 'OWNER'
              token.membershipVersion = 0
              // Break-glass: system owner entered a company with no membership row.
              await recordEvent({
                orgId: org.id,
                actorId: access.id,
                entity: 'Organization',
                entityId: org.id,
                action: 'BREAK_GLASS',
                after: {
                  reason: 'system_owner_no_membership',
                  roleAssumed: 'OWNER',
                  previousOrgId,
                },
              })
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
