import { describe, expect, it } from 'vitest'

import { buildItemTableColumns, ITEM_COLUMN_LABELS } from '@/lib/item-table-columns'
import { Decimal } from '@/lib/money'
import { openOrderQuantities } from '@/server/services/item.service'
import { inRolledBackTransaction, makeOrg, CODE, type Fixture } from './ledger-helpers'
import type { Tx } from '@/server/db'

const suite = process.env.DATABASE_URL ? describe : describe.skip

describe('item table columns for open orders', () => {
  it('includes qty on PO/SO, avail qty, and preferred supplier', () => {
    const cols = buildItemTableColumns([{ id: 's1', name: 'Main' }])
    const ids = cols.map((c) => c.id)

    expect(ids).toContain('qtyOnPo')
    expect(ids).toContain('qtyOnSo')
    expect(ids).toContain('availQty')
    expect(ids).toContain('preferredSupplier')
    expect(ids.indexOf('qtyOnPo')).toBeGreaterThan(ids.indexOf('onHand'))
    expect(ids.indexOf('qtyOnSo')).toBeGreaterThan(ids.indexOf('qtyOnPo'))
    expect(ids.indexOf('availQty')).toBeGreaterThan(ids.indexOf('qtyOnSo'))
    expect(ITEM_COLUMN_LABELS.qtyOnPo).toBe('Qty on PO')
    expect(ITEM_COLUMN_LABELS.preferredSupplier).toBe('Preferred supplier')
  })
})

suite('open order quantities on products', () => {
  async function inventoryItem(tx: Tx, fixture: Fixture, name: string) {
    return tx.item.create({
      data: {
        orgId: fixture.ctx.orgId,
        name,
        type: 'INVENTORY',
        salesPrice: '100',
        purchaseCost: '40',
        incomeAccountId: fixture.accounts[CODE.sales],
        inventoryAccountId: fixture.accounts['1200'],
        cogsAccountId: fixture.accounts['5000'],
      },
      select: { id: true },
    })
  }

  it('sums still-to-receive on open POs and still-to-invoice on open SOs', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await inventoryItem(tx, fixture, 'AC Unit')
      const other = await inventoryItem(tx, fixture, 'Filter')

      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'CoolAir Supply' },
        select: { id: true },
      })
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Hotel Guest' },
        select: { id: true },
      })

      await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'PURCHASE_ORDER',
          number: 'PO-TEST-1',
          vendorId: vendor.id,
          date: new Date('2026-03-01'),
          status: 'OPEN',
          currencyCode: 'USD',
          subtotal: '0',
          taxTotal: '0',
          total: '0',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                itemId: item.id,
                description: 'AC',
                quantity: '10',
                quantityReceived: '3',
                unitPrice: '40',
                amount: '0',
                taxAmount: '0',
              },
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 2,
                itemId: other.id,
                description: 'Filter',
                quantity: '5',
                quantityReceived: '0',
                unitPrice: '10',
                amount: '0',
                taxAmount: '0',
              },
            ],
          },
        },
      })

      await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'PURCHASE_ORDER',
          number: 'PO-TEST-CLOSED',
          vendorId: vendor.id,
          date: new Date('2026-03-02'),
          status: 'CLOSED',
          currencyCode: 'USD',
          subtotal: '0',
          taxTotal: '0',
          total: '0',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                itemId: item.id,
                description: 'Should ignore',
                quantity: '99',
                quantityReceived: '0',
                unitPrice: '40',
                amount: '0',
                taxAmount: '0',
              },
            ],
          },
        },
      })

      await tx.salesDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'SALES_ORDER',
          number: 'SO-TEST-1',
          customerId: customer.id,
          date: new Date('2026-03-05'),
          status: 'PARTIAL',
          subtotal: '0',
          taxTotal: '0',
          total: '0',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                itemId: item.id,
                description: 'AC',
                quantity: '8',
                quantityInvoiced: '2',
                unitPrice: '100',
                amount: '0',
                taxAmount: '0',
                incomeAccountId: fixture.accounts[CODE.sales],
              },
            ],
          },
        },
      })

      const qtys = await openOrderQuantities(fixture.ctx, [item.id, other.id], { client: tx })

      expect(qtys.get(item.id)?.qtyOnPo.toFixed(2)).toBe('7.00')
      expect(qtys.get(item.id)?.qtyOnSo.toFixed(2)).toBe('6.00')
      expect(qtys.get(other.id)?.qtyOnPo.toFixed(2)).toBe('5.00')
      expect(qtys.get(other.id)?.qtyOnSo.toFixed(2)).toBe('0.00')

      const onHand = new Decimal('20')
      const avail = onHand.minus(qtys.get(item.id)!.qtyOnSo)
      expect(avail.toFixed(2)).toBe('14.00')
    })
  })

  it('stores preferred vendor on an inventory item', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Preferred Co' },
        select: { id: true, displayName: true },
      })
      const item = await tx.item.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'Preferred Stock',
          type: 'INVENTORY',
          salesPrice: '50',
          purchaseCost: '20',
          incomeAccountId: fixture.accounts[CODE.sales],
          inventoryAccountId: fixture.accounts['1200'],
          cogsAccountId: fixture.accounts['5000'],
          preferredVendorId: vendor.id,
        },
        select: {
          preferredVendorId: true,
          preferredVendor: { select: { displayName: true } },
        },
      })

      expect(item.preferredVendorId).toBe(vendor.id)
      expect(item.preferredVendor?.displayName).toBe('Preferred Co')
    })
  })
})
