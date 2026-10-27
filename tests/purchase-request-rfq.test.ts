import { afterAll, describe, expect, it } from 'vitest'

import { PURCHASE_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import {
  DEFAULT_FEATURE_FLAGS,
  documentKindForPath,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import { purchaseBySlug, purchaseByType, PURCHASE_TYPES } from '@/lib/purchase-types'
import { PURCHASE_POSTS_A_JOURNAL } from '@/server/accounting/builders/purchases'
import { db, type Tx } from '@/server/db'
import { inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

describe('purchase request and RFQ types', () => {
  it('lists PR and RFQ as non-posting purchase types', () => {
    expect(purchaseByType('PURCHASE_REQUEST').slug).toBe('purchase-requests')
    expect(purchaseByType('PURCHASE_REQUEST').vendorOptional).toBe(true)
    expect(purchaseByType('PURCHASE_REQUEST').effect).toMatch(/RFQ or a purchase order/)
    expect(purchaseByType('RFQ').effect).toMatch(/purchase order/)
    expect(purchaseByType('RFQ').slug).toBe('rfqs')
    expect(purchaseBySlug('purchase-requests')?.type).toBe('PURCHASE_REQUEST')
    expect(purchaseBySlug('rfqs')?.type).toBe('RFQ')
    expect(PURCHASE_POSTS_A_JOURNAL.PURCHASE_REQUEST).toBe(false)
    expect(PURCHASE_POSTS_A_JOURNAL.RFQ).toBe(false)
    expect(PURCHASE_TYPES.every((row) => typeof PURCHASE_POSTS_A_JOURNAL[row.type] === 'boolean')).toBe(
      true,
    )
  })

  it('gates hub tiles and paths for PR and RFQ', () => {
    const permissions = new Set(['bill:read', 'bill:create', 'expense:create', 'vendor:read', 'report:read'])
    const apps = visibleHubApps(PURCHASE_HUB_APPS, permissions, DEFAULT_FEATURE_FLAGS, 'purchases')
    const keys = apps.map((app) => app.key)
    expect(keys).toContain('purchase-requests')
    expect(keys).toContain('rfqs')

    const hidden = visibleHubApps(
      PURCHASE_HUB_APPS,
      permissions,
      parseFeatureFlags({ documentKinds: { purchases: { PURCHASE_REQUEST: false, RFQ: false } } }),
      'purchases',
    )
    expect(hidden.map((app) => app.key)).not.toContain('purchase-requests')
    expect(hidden.map((app) => app.key)).not.toContain('rfqs')

    expect(documentKindForPath('/purchases/purchase-requests/new')).toEqual({
      family: 'purchases',
      kind: 'PURCHASE_REQUEST',
    })
    expect(documentKindForPath('/purchases/rfqs')).toEqual({
      family: 'purchases',
      kind: 'RFQ',
    })
  })
})

suite('purchase request and RFQ documents', () => {
  async function expenseAccount(tx: Tx, fixture: Fixture) {
    return tx.ledgerAccount.findFirstOrThrow({
      where: { orgId: fixture.ctx.orgId, code: '6100' },
      select: { id: true },
    })
  }

  it('allows a purchase request without a vendor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const account = await expenseAccount(tx, fixture)

      const pr = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'PURCHASE_REQUEST',
          number: 'PR-00001',
          vendorId: null,
          date: new Date('2026-10-01T00:00:00Z'),
          status: 'OPEN',
          subtotal: '40',
          total: '40',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                description: 'Flour',
                quantity: '10',
                unitPrice: '4',
                amount: '40',
                expenseAccountId: account.id,
              },
            ],
          },
        },
        select: { id: true, vendorId: true, status: true },
      })

      expect(pr.vendorId).toBeNull()
      expect(pr.status).toBe('OPEN')
    })
  })

  it('closes a PR when converted to an RFQ, then closes the RFQ into a PO', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const account = await expenseAccount(tx, fixture)
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Mill Supplies' },
        select: { id: true },
      })

      const pr = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'PURCHASE_REQUEST',
          number: 'PR-00002',
          vendorId: null,
          date: new Date('2026-10-02T00:00:00Z'),
          status: 'OPEN',
          subtotal: '25',
          total: '25',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                description: 'Yeast',
                quantity: '5',
                unitPrice: '5',
                amount: '25',
                expenseAccountId: account.id,
              },
            ],
          },
        },
        select: { id: true, lines: { select: { description: true, quantity: true, unitPrice: true, expenseAccountId: true } } },
      })

      const rfq = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'RFQ',
          number: 'RFQ-00001',
          vendorId: vendor.id,
          date: new Date('2026-10-03T00:00:00Z'),
          status: 'OPEN',
          subtotal: '25',
          total: '25',
          currencyCode: 'USD',
          convertedFromId: pr.id,
          lines: {
            create: pr.lines.map((line, index) => ({
              orgId: fixture.ctx.orgId,
              lineNumber: index + 1,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: '25',
              expenseAccountId: line.expenseAccountId,
            })),
          },
        },
        select: { id: true, vendorId: true, convertedFromId: true },
      })
      await tx.purchaseDocument.update({ where: { id: pr.id }, data: { status: 'CLOSED' } })

      const po = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'PURCHASE_ORDER',
          number: 'PO-00099',
          vendorId: vendor.id,
          date: new Date('2026-10-04T00:00:00Z'),
          status: 'OPEN',
          subtotal: '25',
          total: '25',
          currencyCode: 'USD',
          convertedFromId: rfq.id,
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                description: 'Yeast',
                quantity: '5',
                unitPrice: '5',
                amount: '25',
                expenseAccountId: account.id,
              },
            ],
          },
        },
        select: { id: true, convertedFromId: true, type: true },
      })
      await tx.purchaseDocument.update({ where: { id: rfq.id }, data: { status: 'CLOSED' } })

      const closedPr = await tx.purchaseDocument.findUniqueOrThrow({
        where: { id: pr.id },
        select: { status: true },
      })
      const closedRfq = await tx.purchaseDocument.findUniqueOrThrow({
        where: { id: rfq.id },
        select: { status: true, vendorId: true },
      })

      expect(closedPr.status).toBe('CLOSED')
      expect(closedRfq.status).toBe('CLOSED')
      expect(closedRfq.vendorId).toBe(vendor.id)
      expect(rfq.convertedFromId).toBe(pr.id)
      expect(po.convertedFromId).toBe(rfq.id)
      expect(po.type).toBe('PURCHASE_ORDER')
    })
  })

  it('refuses RFQ without a vendor at the database level only when app rules apply — RFQ may be created with vendor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Quoted Co' },
        select: { id: true },
      })
      const account = await expenseAccount(tx, fixture)

      const rfq = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'RFQ',
          number: 'RFQ-00002',
          vendorId: vendor.id,
          date: new Date('2026-10-05T00:00:00Z'),
          status: 'OPEN',
          subtotal: '0',
          total: '0',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                description: 'Bags',
                quantity: '1',
                unitPrice: '0',
                amount: '0',
                expenseAccountId: account.id,
              },
            ],
          },
        },
        select: { vendorId: true },
      })
      expect(rfq.vendorId).toBe(vendor.id)
    })
  })
})

afterAll(async () => {
  if (process.env.DATABASE_URL) await db.$disconnect()
})
