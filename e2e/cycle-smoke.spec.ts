import { expect, test } from '@playwright/test'

import { CYCLE_PATH, loginStaff } from './helpers'

/**
 * Operating-cycle smoke: sell → pay → buy → stock → recon → close.
 *
 * Always documents the path and checks the staff login door.
 * The authenticated walk hits each local screen and asserts headings / copy.
 * Skips when E2E_EMAIL or E2E_PASSWORD are unset (CI without a seeded clerk).
 *
 * Selectors are the real page titles from PageHeader / invoice home / POS dashboard:
 * Point of Sale, What customers owe, Payments received, Bills, Stock on hand,
 * Reconcile, Accounting periods (+ Scale checklist).
 */
test.describe('cycle smoke — sell → pay → buy → stock → recon → close', () => {
  test('documents the operating-cycle path', () => {
    expect(CYCLE_PATH.map((step) => step.name)).toEqual([
      'sell',
      'sell-invoices',
      'pay',
      'buy',
      'stock',
      'recon',
      'close',
    ])
    expect(CYCLE_PATH.map((step) => step.path)).toEqual([
      '/pos',
      '/sales/invoices',
      '/payments',
      '/purchases/bills',
      '/inventory/stock',
      '/banking/reconcile',
      '/periods',
    ])
  })

  test('staff login door loads', async ({ page }) => {
    const response = await page.goto('/login/staff')
    expect(response?.ok() ?? false).toBeTruthy()
    await expect(page.getByRole('textbox', { name: /email or mobile/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /^password$/i })).toBeVisible()
  })

  test('authenticated walk visits each cycle door', async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run the cycle walk')

    await loginStaff(page, email!, password!)

    for (const step of CYCLE_PATH) {
      await page.goto(step.path)
      await expect(page, step.name).not.toHaveURL(/\/login/)
      await expect(page.locator('body'), step.name).toContainText(step.expect)
    }

    await expect(page.locator('#scale-checklist')).toContainText(/live-year window|scale checklist/i)
    await expect(page.locator('#year-archive')).toContainText(/archive/i)
  })
})
