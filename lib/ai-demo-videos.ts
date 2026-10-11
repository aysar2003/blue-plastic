/**
 * AI-generated product demo reels for the public marketing site.
 * Each reel is a timed sequence of frames + captions about SOM ERP.
 */

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
  frames: AiDemoFrame[]
}

const FRAME = (name: string) => `/marketing/ai/${name}`

export const AI_DEMO_VIDEOS: AiDemoVideo[] = [
  {
    id: 'sign-in',
    title: 'Sign in and open the books',
    durationLabel: '28 sec',
    summary: 'AI walkthrough — login, open Apps, reach the right company.',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'SOM ERP — how to use the system',
        seconds: 3,
      },
      {
        src: FRAME('som-erp-01-signin.jpg'),
        caption: 'Open /login and sign in with your company email.',
        seconds: 5,
      },
      {
        src: FRAME('som-erp-01b-apps.jpg'),
        caption: 'Land on Apps — Sales, Purchases, Inventory, Accounting, POS.',
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
    durationLabel: '32 sec',
    summary: 'AI walkthrough — raise an invoice and collect payment.',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'Sales in SOM ERP',
        seconds: 3,
      },
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
    durationLabel: '30 sec',
    summary: 'AI walkthrough — vendor bills and inventory on the shelf.',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'Purchases & stock in SOM ERP',
        seconds: 3,
      },
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
    durationLabel: '28 sec',
    summary: 'AI walkthrough — register sales that post to the books.',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'POS in SOM ERP',
        seconds: 3,
      },
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
    durationLabel: '32 sec',
    summary: 'AI walkthrough — P&L, bank reconcile, close the period.',
    frames: [
      {
        src: FRAME('som-erp-00-title.jpg'),
        caption: 'Reports & close in SOM ERP',
        seconds: 3,
      },
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
