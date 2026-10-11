/**
 * Public marketing site copy: company contact and how-to lessons.
 *
 * Contact defaults match the primary Al Furaat organisation. The landing page
 * prefers live values from the database when they are present.
 */

export type MarketingContact = {
  companyName: string
  contactName: string
  phone: string
  email: string
  secondaryEmail?: string
  address: string
  city: string
  region: string
  whatsappE164: string
}

export type TutorialLesson = {
  id: string
  title: string
  duration: string
  summary: string
  /** Optional YouTube video id — when set, the lesson embeds that video. */
  youtubeId?: string
  steps: string[]
}

export const DEFAULT_MARKETING_CONTACT: MarketingContact = {
  companyName: 'AL FURAAT GROUP OF COMPANY',
  contactName: 'Abdisalam Abdullahi Mohamed',
  phone: '252-617305588',
  email: 'aysaryare@gmail.com',
  secondaryEmail: 'info@furaat.so',
  address: 'Wada Balcad aad ee Somali Star ka bilaabata',
  city: 'Kismaayo',
  region: 'Somalia',
  whatsappE164: '252617305588',
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: 'sign-in',
    title: 'Sign in and open the books',
    duration: '2 min',
    summary: 'How staff reach SOM ERP and land in the right company.',
    steps: [
      'Open the website and tap Login (or go to /login).',
      'Enter the email and password given to your user account.',
      'After sign-in you land on Apps — pick Sales, Purchases, Inventory, or Accounting.',
      'Use the company switcher when your group has more than one database.',
    ],
  },
  {
    id: 'sales',
    title: 'Sell: invoice to payment',
    duration: '4 min',
    summary: 'Raise a customer invoice and collect the money into the ledger.',
    steps: [
      'Go to Sales → Invoices → New.',
      'Choose the customer, add lines (items or services), and post the invoice.',
      'When money arrives, open Payments → New and apply it to the invoice.',
      'If cash sat in Undeposited Funds, record a bank deposit so the statement matches.',
    ],
  },
  {
    id: 'purchases',
    title: 'Buy: bill and receive stock',
    duration: '4 min',
    summary: 'Enter a vendor bill so payables and inventory stay in balance.',
    steps: [
      'Go to Purchases → Bills → New (or start from a purchase order).',
      'Add the vendor and the goods or expense lines.',
      'Post the bill — inventory items update stock; the payable hits Accounts Payable.',
      'Pay later from Bill payments, one payment across as many bills as you need.',
    ],
  },
  {
    id: 'pos',
    title: 'Point of sale at the counter',
    duration: '3 min',
    summary: 'Open a register session and ring sales that post to the books.',
    steps: [
      'Open POS, choose a register, and start or resume a session.',
      'Scan or pick items, take payment, and print the thermal receipt.',
      'Each sale posts income, stock, and till money into the ledger.',
      'Close the session at day end and transfer till cash to the bank account.',
    ],
  },
  {
    id: 'reports',
    title: 'Reports and month close',
    duration: '3 min',
    summary: 'Read profit, reconcile the bank, and lock the period.',
    steps: [
      'Open Reports → Profit and Loss and Balance Sheet for the period.',
      'Reconcile each bank account against the statement.',
      'Work the close checklist on Periods and fix anything it flags.',
      'Close the period so nothing posts into it without reopening.',
    ],
  },
]

export function whatsappUrl(e164: string, text?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function telUrl(phone: string) {
  return `tel:+${phone.replace(/\D/g, '')}`
}

export function mailtoUrl(email: string, subject?: string) {
  return subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`
}
