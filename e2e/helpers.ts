import type { Page } from '@playwright/test'

/** Staff login door → authenticated app (not /login). */
export async function loginStaff(page: Page, email: string, password: string) {
  await page.goto('/login/staff')
  await page.getByRole('textbox', { name: /email or mobile/i }).fill(email)
  await page.getByRole('textbox', { name: /^password$/i }).fill(password)
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 })
}

export const CYCLE_PATH: { name: string; path: string; expect: RegExp }[] = [
  { name: 'sell', path: '/pos', expect: /point of sale|register|till|sale|catalog/i },
  { name: 'sell-invoices', path: '/sales/invoices', expect: /invoice|what customers owe/i },
  { name: 'pay', path: '/payments', expect: /payments received|receive payment/i },
  { name: 'buy', path: '/purchases/bills', expect: /bills/i },
  { name: 'stock', path: '/inventory/stock', expect: /stock on hand/i },
  { name: 'recon', path: '/banking/reconcile', expect: /reconcile/i },
  { name: 'close', path: '/periods', expect: /accounting periods|scale checklist|archive/i },
]
