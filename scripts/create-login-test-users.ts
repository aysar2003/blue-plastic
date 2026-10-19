/**
 * Upsert three local login-test accounts against the first organisation:
 *   staff   — isSystemOwner
 *   company — staff membership (not system owner)
 *   portal  — CUSTOMER + CustomerPortalUser
 *
 * Password for all: TestLogin1!
 * Safe to re-run (idempotent).
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

try {
  process.loadEnvFile('.env')
} catch {
  // already loaded
}

const PASSWORD = 'TestLogin1!'
const STAFF_EMAIL = 'login.test.staff@example.test'
const COMPANY_EMAIL = 'login.test.company@example.test'
const PORTAL_EMAIL = 'login.test.portal@example.test'

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  transactionOptions: { maxWait: 15_000, timeout: 60_000 },
})

async function upsertUser(input: {
  email: string
  name: string
  passwordHash: string
  isSystemOwner: boolean
  homeOrgId: string
}) {
  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        passwordHash: input.passwordHash,
        isSystemOwner: input.isSystemOwner,
        homeOrgId: input.homeOrgId,
        emailVerified: new Date(),
      },
      select: { id: true, email: true },
    })
  }
  return db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      isSystemOwner: input.isSystemOwner,
      homeOrgId: input.homeOrgId,
      emailVerified: new Date(),
    },
    select: { id: true, email: true },
  })
}

async function ensureMembership(input: {
  orgId: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'CUSTOMER'
}) {
  const existing = await db.membership.findUnique({
    where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
    select: { id: true },
  })
  if (existing) {
    return db.membership.update({
      where: { id: existing.id },
      data: {
        role: input.role,
        status: 'ACTIVE',
        acceptedAt: new Date(),
        version: { increment: 1 },
      },
      select: { id: true },
    })
  }
  return db.membership.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
    select: { id: true },
  })
}

async function main() {
  const org = await db.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, featureFlags: true },
  })
  if (!org) {
    throw new Error('No organisation found. Run setup or seed first.')
  }

  const flags: Record<string, unknown> =
    org.featureFlags && typeof org.featureFlags === 'object' && !Array.isArray(org.featureFlags)
      ? { ...(org.featureFlags as Record<string, unknown>) }
      : {}
  flags.enableCustomerPortal = true
  await db.organization.update({
    where: { id: org.id },
    data: { featureFlags: flags as Prisma.InputJsonValue },
  })

  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const staff = await upsertUser({
    email: STAFF_EMAIL,
    name: 'Login Test Staff',
    passwordHash,
    isSystemOwner: true,
    homeOrgId: org.id,
  })
  await ensureMembership({ orgId: org.id, userId: staff.id, role: 'OWNER' })

  const company = await upsertUser({
    email: COMPANY_EMAIL,
    name: 'Login Test Company',
    passwordHash,
    isSystemOwner: false,
    homeOrgId: org.id,
  })
  await ensureMembership({ orgId: org.id, userId: company.id, role: 'ADMIN' })

  let customer = await db.customer.findFirst({
    where: { orgId: org.id, displayName: 'Login Test Customer' },
    select: { id: true },
  })
  if (!customer) {
    customer = await db.customer.create({
      data: {
        orgId: org.id,
        displayName: 'Login Test Customer',
        email: PORTAL_EMAIL,
        isActive: true,
      },
      select: { id: true },
    })
  }

  const portal = await upsertUser({
    email: PORTAL_EMAIL,
    name: 'Login Test Portal',
    passwordHash,
    isSystemOwner: false,
    homeOrgId: org.id,
  })
  await ensureMembership({ orgId: org.id, userId: portal.id, role: 'CUSTOMER' })

  const link = await db.customerPortalUser.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: portal.id } },
    select: { id: true },
  })
  if (!link) {
    await db.customerPortalUser.create({
      data: { orgId: org.id, userId: portal.id, customerId: customer.id },
    })
  } else {
    await db.customerPortalUser.update({
      where: { id: link.id },
      data: { customerId: customer.id },
    })
  }

  console.log(JSON.stringify({
    org: { id: org.id, name: org.name },
    password: PASSWORD,
    accounts: {
      staff: STAFF_EMAIL,
      company: COMPANY_EMAIL,
      portal: PORTAL_EMAIL,
      portalCompanyUrl: `/login/portal?company=${org.id}`,
    },
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
