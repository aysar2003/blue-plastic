import 'server-only'

import type { SetupInput } from '@/lib/validation/auth'
import { hashPassword } from '@/server/auth/password'
import { db } from '@/server/db'
import { conflict } from '@/server/errors'
import { createDefaultSequences } from '@/server/sequences'

/**
 * Is the instance still unconfigured? Drives the redirect from `/sign-in` to
 * `/setup` and guards the setup action itself.
 */
export async function needsSetup(): Promise<boolean> {
  const count = await db.organization.count({ take: 1 })
  return count === 0
}

/**
 * First-run: create the organisation, its owner, and the document sequences, in
 * one transaction. This is the only unauthenticated write in the application, so
 * it refuses to run once an organisation exists — otherwise it would be an open
 * account-creation endpoint.
 */
export async function runSetup(input: SetupInput) {
  if (!(await needsSetup())) {
    throw conflict('This instance has already been set up.')
  }

  const passwordHash = await hashPassword(input.password)

  return db.$transaction(async (tx) => {
    // Re-check inside the transaction: two people hitting Setup at once must not
    // produce two organisations.
    if ((await tx.organization.count({ take: 1 })) > 0) {
      throw conflict('This instance has already been set up.')
    }

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        baseCurrency: input.baseCurrency,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
      },
      select: { id: true, name: true },
    })

    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        emailVerified: new Date(),
        isSystemOwner: true,
        homeOrgId: organization.id,
      },
      select: { id: true, email: true },
    })

    await tx.membership.create({
      data: {
        orgId: organization.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    await createDefaultSequences(tx, organization.id)

    await tx.auditLog.create({
      data: {
        orgId: organization.id,
        actorId: user.id,
        entity: 'Organization',
        entityId: organization.id,
        action: 'CREATE',
        after: { name: organization.name, owner: user.email },
      },
    })

    return { organizationId: organization.id, userId: user.id, email: user.email }
  })
}
