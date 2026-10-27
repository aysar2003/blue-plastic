/**
 * Live E2E: confirm pending rent payment TEST-EVC-LIVETEST-002 as system owner.
 * Run: pnpm exec tsx tmp/live-confirm-rent.mts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated.
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

function extendRentExpiry(current: Date | null, months: number): Date {
  const base =
    current && current.getTime() > Date.now() ? new Date(current.getTime()) : new Date()
  const next = new Date(base)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

try {
  const owner = await prisma.user.findFirst({
    where: { isSystemOwner: true },
    select: { id: true, email: true, name: true },
  })
  if (!owner) throw new Error('No system owner')

  const pending = await prisma.companyRentPayment.findMany({
    where: { status: 'PENDING' },
    include: {
      organization: { select: { id: true, name: true, rentExpiresAt: true, maxUsers: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(
    JSON.stringify(
      {
        ownerEmail: owner.email,
        pending: pending.map((p) => ({
          id: p.id,
          ref: p.reference,
          company: p.organization.name,
          months: p.planMonths,
          maxUsers: p.planMaxUsers,
        })),
      },
      null,
      2,
    ),
  )

  const target =
    pending.find((p) => p.reference === 'TEST-EVC-VERCEL-001') ??
    pending.find((p) => p.reference === 'TEST-EVC-LIVETEST-002') ??
    pending[0]
  if (!target) {
    console.log('No pending payment')
  } else {
    const newExpiry = extendRentExpiry(target.organization.rentExpiresAt, target.planMonths)

    await prisma.$transaction(async (tx) => {
      await tx.companyRentPayment.update({
        where: { id: target.id },
        data: {
          status: 'CONFIRMED',
          reviewedAt: new Date(),
          reviewedBy: owner.id,
          reviewNote: `Prod E2E confirm ${target.reference}`,
        },
      })
      await tx.organization.update({
        where: { id: target.orgId },
        data: {
          rentExpiresAt: newExpiry,
          ...(target.planMaxUsers != null ? { maxUsers: target.planMaxUsers } : {}),
          rentNote: `Confirmed ${target.planName} via ${target.reference}`,
        },
      })
    })

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: target.orgId },
      select: { name: true, rentExpiresAt: true, maxUsers: true, rentNote: true },
    })

    console.log(
      JSON.stringify(
        {
          confirmed: target.reference,
          company: org.name,
          rentExpiresAt: org.rentExpiresAt?.toISOString() ?? null,
          maxUsers: org.maxUsers,
          rentNote: org.rentNote,
        },
        null,
        2,
      ),
    )
  }
} finally {
  await prisma.$disconnect()
}
