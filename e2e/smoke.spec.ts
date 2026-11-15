import { expect, test } from '@playwright/test'

/**
 * Smoke path: login door → (optional) sell surface.
 *
 * Always checks that the staff login door renders.
 * Full login→POS path runs only when E2E_EMAIL + E2E_PASSWORD are set
 * (and the app is reachable at E2E_BASE_URL, default http://127.0.0.1:3000).
 */
test.describe('smoke', () => {
  test('staff login door loads', async ({ page }) => {
    const response = await page.goto('/login/staff')
    expect(response?.ok() ?? false).toBeTruthy()
    await expect(page.getByRole('textbox', { name: /email or mobile/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /^password$/i })).toBeVisible()
  })

  test('login → POS sell path', async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run the sell path')

    await page.goto('/login/staff')
    await page.getByRole('textbox', { name: /email or mobile/i }).fill(email!)
    await page.getByRole('textbox', { name: /^password$/i }).fill(password!)
    await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()

    // Land somewhere authenticated (dashboard, apps, or forced onboarding).
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 })

    await page.goto('/pos')
    await expect(page).not.toHaveURL(/\/login/)
    // POS terminal or a gate (register / store pick) — either proves the sell door opens.
    const body = page.locator('body')
    await expect(body).toContainText(/pos|register|till|sale|catalog|point of sale/i)
  })
})
