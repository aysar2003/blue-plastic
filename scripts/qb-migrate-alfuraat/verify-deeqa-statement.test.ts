import { describe, expect, it } from 'vitest'

describe('deeqa-statement', () => {
  it(
    'shows sequenced open items ending at QuickBooks balance',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { PrismaClient } = await import('@prisma/client')
      const { DEFAULT_FEATURE_FLAGS } = await import('@/lib/feature-flags')
      const { permissionsFor } = await import('@/server/auth/permissions')
      const { statement } = await import('@/server/services/receivables.service')

      const prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
        }),
      })

      const orgId = 'cmvezuwzw000507l8ewxbhc15'
      const deeqaId = 'c9f9d5e4b0eebe2622a8f71cd'
      const organization = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
      const membership = await prisma.membership.findFirstOrThrow({
        where: { orgId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
        include: { user: true },
      })
      const { logoStorageKey, ...orgFields } = organization
      const ctx = {
        orgId,
        userId: membership.userId,
        role: membership.role,
        permissions: permissionsFor(membership.role),
        isSystemOwner: membership.user.isSystemOwner,
        canConnect: membership.canConnect,
        portalCustomerId: null,
        features: { ...DEFAULT_FEATURE_FLAGS, enableDocumentApprovals: false },
        organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          image: membership.user.image,
        },
      }

      const result = await statement(
        ctx as never,
        deeqaId,
        { from: '2000-01-01', to: '2099-12-31' },
        { client: prisma as never },
      )

      const byKind: Record<string, number> = {}
      for (const entry of result.entries) {
        byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1
      }
      console.log(
        JSON.stringify(
          {
            opening: result.opening.toString(),
            closing: result.closing.toString(),
            entryCount: result.entries.length,
            byKind,
            first: result.entries.slice(0, 5).map((e) => ({
              date: e.date.toISOString().slice(0, 10),
              kind: e.kind,
              number: e.number,
              charge: e.charge.toString(),
              credit: e.credit.toString(),
              balance: e.balance.toString(),
            })),
            last: result.entries.at(-1)
              ? {
                  date: result.entries.at(-1)!.date.toISOString().slice(0, 10),
                  kind: result.entries.at(-1)!.kind,
                  number: result.entries.at(-1)!.number,
                  balance: result.entries.at(-1)!.balance.toString(),
                }
              : null,
          },
          null,
          2,
        ),
      )

      expect(result.closing.toFixed(2)).toBe('111823.35')
      expect(result.entries.length).toBeGreaterThan(20)
      expect(byKind.INVOICE ?? 0).toBeGreaterThan(10)
      expect(byKind.PAYMENT ?? 0).toBeGreaterThan(0)
      await prisma.$disconnect()
    },
    120_000,
  )
})
