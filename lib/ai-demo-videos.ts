/**
 * Live system practice lessons for the marketing site.
 * Previews show the real product UI; each lesson opens the live desk to practice.
 */

import { LOGIN_COMPANY, LOGIN_HUB } from '@/lib/login-paths'

export type AiDemoFrame = {
  src: string
  caption: string
  seconds?: number
}

export type AiDemoVideo = {
  id: string
  title: string
  durationLabel: string
  summary: string
  /** Live route to open so the learner practices in the real system. */
  openHref: string
  openLabel: string
  frames: AiDemoFrame[]
}

const FRAME = (name: string) => `/marketing/ai/${name}`

export const AI_DEMO_VIDEOS: AiDemoVideo[] = [
  {
    id: 'sign-in',
    title: 'Sign in and open the books',
    durationLabel: 'Practice',
    summary: 'Open the real company login, sign in, then land on Apps for your company.',
    openHref: LOGIN_COMPANY,
    openLabel: 'Open company login',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'Start at /login — pick Company books when you work inside one company.',
        seconds: 4,
      },
      {
        src: FRAME('som-erp-01-signin.jpg'),
        caption: 'Sign in on /login/company with your company email or mobile.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-01b-apps.jpg'),
        caption: 'After sign-in you reach Apps — Sales, Purchases, Inventory, Accounting, POS.',
        seconds: 5,
      },
      {
        src: FRAME('som-erp-01-signin.jpg'),
        caption: 'Use the company switcher when you manage more than one database.',
        seconds: 4,
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sell: invoice to payment',
    durationLabel: 'Practice',
    summary: 'Raise a real invoice and collect payment inside the live Sales desk.',
    openHref: '/sales/invoices/new',
    openLabel: 'Open new invoice',
    frames: [
      {
        src: FRAME('som-erp-02-invoice.jpg'),
        caption: 'Sales → Invoices → New. Add customer and lines, then post.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-02b-payment.jpg'),
        caption: 'Payments → New. Apply cash or transfer to the open invoice.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-05-reports.jpg'),
        caption: 'Income and receivables update in the ledger automatically.',
        seconds: 5,
      },
    ],
  },
  {
    id: 'purchases',
    title: 'Buy: bill and receive stock',
    durationLabel: 'Practice',
    summary: 'Enter a vendor bill and receive stock in the live Purchases desk.',
    openHref: '/purchases/bills/new',
    openLabel: 'Open new bill',
    frames: [
      {
        src: FRAME('som-erp-03-bill.jpg'),
        caption: 'Purchases → Bills → New. Enter vendor and goods lines.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-03b-stock.jpg'),
        caption: 'Inventory items increase stock on hand when the bill posts.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-03-bill.jpg'),
        caption: 'Pay later from Bill payments — one payment, many bills.',
        seconds: 5,
      },
    ],
  },
  {
    id: 'pos',
    title: 'Point of sale at the counter',
    durationLabel: 'Practice',
    summary: 'Open a live POS register and take a sale that posts to the books.',
    openHref: '/pos',
    openLabel: 'Open POS',
    frames: [
      {
        src: FRAME('som-erp-04-pos.jpg'),
        caption: 'Open a register session. Add items to the cart.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-04-pos.jpg'),
        caption: 'Take cash or mobile money — print the thermal receipt.',
        seconds: 5,
      },
      {
        src: FRAME('som-erp-01b-apps.jpg'),
        caption: 'Every sale posts income, stock, and till money to the ledger.',
        seconds: 5,
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports and month close',
    durationLabel: 'Practice',
    summary: 'Read Profit & Loss and reconcile bank in the live Reports desk.',
    openHref: '/reports/profit-loss',
    openLabel: 'Open Profit & Loss',
    frames: [
      {
        src: FRAME('som-erp-05-reports.jpg'),
        caption: 'Reports → Profit and Loss. Read income, costs, and net.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-05b-reconcile.jpg'),
        caption: 'Reconcile each bank account to the statement.',
        seconds: 6,
      },
      {
        src: FRAME('som-erp-05-reports.jpg'),
        caption: 'Close the period so history stays locked and auditable.',
        seconds: 5,
      },
    ],
  },
]

/** Hub entry used when the learner is not signed in yet. */
export const PRACTICE_START_HREF = LOGIN_HUB
