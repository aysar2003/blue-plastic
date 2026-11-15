import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('QBO/Odoo document chrome + copy', () => {
  it('keeps shared sales toolbar and copy entry points', () => {
    const form = read('components/sales/document-form.tsx')
    expect(form).toContain('function SalesDocumentToolbar')
    expect(form).toContain('new?copy=')
    expect(form).toContain('copiedFromNumber')

    const salesNew = read('app/(app)/sales/[type]/new/page.tsx')
    expect(salesNew).toContain('query.copy')
    expect(salesNew).toContain('copiedFromNumber')

    expect(existsSync(path.join(root, 'app/(app)/sales/[type]/[id]/page.tsx'))).toBe(true)
    expect(read('app/(app)/sales/[type]/[id]/page.tsx')).toContain('new?copy=')
  })

  it('keeps purchase copy + toolbar actions', () => {
    const form = read('components/purchases/bill-form.tsx')
    expect(form).toContain('new?copy=')
    expect(form).toContain('PrinterIcon')
    expect(form).toContain('copiedFromNumber')

    const purchaseNew = read('app/(app)/purchases/[type]/new/page.tsx')
    expect(purchaseNew).toContain('query.copy')
  })

  it('keeps payment and adjustment copy seeds', () => {
    expect(read('app/(app)/payments/new/page.tsx')).toContain('query.copy')
    expect(read('components/sales/payment-form.tsx')).toContain('copiedFromNumber')
    expect(read('app/(app)/inventory/adjustments/new/page.tsx')).toContain('query.copy')
    expect(read('components/inventory/adjustment-form.tsx')).toContain('copiedFromNumber')
  })

  it('exposes light chrome on create-only money/stock forms', () => {
    expect(existsSync(path.join(root, 'components/forms/form-chrome-toolbar.tsx'))).toBe(true)
    expect(read('components/purchases/bill-payment-form.tsx')).toContain('FormChromeToolbar')
    expect(read('components/banking/deposit-form.tsx')).toContain('FormChromeToolbar')
    expect(read('components/banking/transfer-form.tsx')).toContain('FormChromeToolbar')
    expect(read('components/inventory/store-transfer-form.tsx')).toContain('FormChromeToolbar')
  })

  it('supports copy seeds on bill payment, banking, and store transfer', () => {
    expect(read('server/services/bill-payment.service.ts')).toContain('export async function get(')
    expect(read('app/(app)/bill-payments/new/page.tsx')).toContain('query.copy')
    expect(read('server/services/banking.service.ts')).toContain('export async function getTransfer')
    expect(read('server/services/banking.service.ts')).toContain('export async function getDeposit')
    expect(read('app/(app)/banking/transfers/new/page.tsx')).toContain('params.copy')
    expect(read('app/(app)/banking/deposits/new/page.tsx')).toContain('params.copy')
    expect(read('server/services/inventory.service.ts')).toContain('export async function getStoreTransfer')
    expect(read('app/(app)/stores/transfer/new/page.tsx')).toContain('query.copy')
  })
})
