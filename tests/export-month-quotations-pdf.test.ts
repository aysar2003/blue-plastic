/**
 * One-shot: write this month's AFG quotations pack PDF into Downloads.
 * Run: pnpm exec vitest run tests/export-month-quotations-pdf.test.ts
 */
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { letterheadOf } from '@/lib/letterhead'
import { parseDocumentTemplate } from '@/lib/document-template'
import {
  renderDocumentPackPdf,
  salesDetailToPdfInput,
} from '@/server/reports/sales-document-pdf'
import * as salesService from '@/server/services/sales.service'

try {
  process.loadEnvFile('.env.local')
} catch {
  try {
    process.loadEnvFile('.env')
  } catch {
    /* already set */
  }
}

describe('export month quotations pdf', () => {
  it.skipIf(!process.env.DATABASE_URL)(
    'writes October 2026 quotations pack to Downloads',
    async () => {
    const url = process.env.DATABASE_URL!
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

    try {
      const org = await prisma.organization.findFirst({
        where: { name: 'AL FURAAT GROUP OF COMPANY' },
        select: {
          id: true,
          name: true,
          legalName: true,
          timeZone: true,
          baseCurrency: true,
          phone: true,
          email: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          documentTemplate: true,
          taxRegistrationNumber: true,
        },
      })
      expect(org).toBeTruthy()

      const from = new Date(Date.UTC(2026, 9, 1))
      const to = new Date(Date.UTC(2026, 9, 31, 23, 59, 59, 999))
      const rows = await prisma.salesDocument.findMany({
        where: {
          orgId: org!.id,
          type: 'QUOTATION',
          deletedAt: null,
          status: { not: 'VOID' },
          date: { gte: from, lte: to },
        },
        select: { id: true, number: true, date: true },
        orderBy: [{ date: 'asc' }, { number: 'asc' }],
      })
      expect(rows.length).toBeGreaterThan(0)

      const ctx = {
        orgId: org!.id,
        organization: {
          id: org!.id,
          name: org!.name,
          timeZone: org!.timeZone,
          baseCurrency: org!.baseCurrency,
        },
        user: { id: 'export', name: 'Export' },
        permissions: new Set(['invoice:read']),
        features: {},
      } as unknown as Parameters<typeof salesService.getMany>[0]

      const documents = await salesService.getMany(ctx, rows.map((row) => row.id))
      const company = letterheadOf({
        name: org!.name,
        legalName: org!.legalName,
        phone: org!.phone,
        email: org!.email,
        addressLine1: org!.addressLine1,
        addressLine2: org!.addressLine2,
        city: org!.city,
        region: org!.region,
        postalCode: org!.postalCode,
        country: org!.country,
      })
      const template = parseDocumentTemplate(org!.documentTemplate)
      const shared = {
        template,
        orgName: company.name,
        orgAddress: company.address ? [company.address] : [],
        orgPhone: company.phone,
        orgEmail: company.email,
        timeZone: org!.timeZone,
      }

      const bytes = renderDocumentPackPdf({
        runningTotals: true,
        documents: documents.map((document) => salesDetailToPdfInput(document, shared)),
      })

      const out = join(
        homedir(),
        'Downloads',
        `AFG-quotations-October-2026-${rows.length}papers.pdf`,
      )
      writeFileSync(out, bytes)
      console.log(`PDF_PATH=${out}`)
      console.log(`COUNT=${rows.length}`)
      console.log(`NUMBERS=${rows.map((r) => r.number).join(',')}`)
      expect(bytes.byteLength).toBeGreaterThan(1000)
    } finally {
      await prisma.$disconnect()
    }
  },
  )
})
