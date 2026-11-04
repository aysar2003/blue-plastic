import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MANUAL_CHAPTERS, chapterTitle } from '@/content/user-manual'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Hagitaan' }

const FLOWS: { title: string; steps: { text: string; href?: string }[] }[] = [
  {
    title: 'Dejinta',
    steps: [
      { text: 'Ku rakib chart of accounts, ka dibna magac-beddel / ku dar waxa ganacsigu isticmaalo.', href: '/accounts' },
      { text: 'Deji base currency iyo bisha sannadka maaliyadeed.', href: '/settings/organization' },
      { text: 'Hubi default accounts (receivables, payables, …).', href: '/settings/accounts' },
      { text: 'Geli tax agencies, rates iyo codes kahor wax canshuur leh.', href: '/settings/tax' },
      { text: 'Geli customers iyo vendors (iyo opening balances haddii loo baahdo).', href: '/customers' },
      { text: 'Geli products & services iyo accounts iib/iibsi.', href: '/items' },
    ],
  },
  {
    title: 'Iib, bilow ilaa dhamaad',
    steps: [
      { text: 'Samee invoice — debit AR, credit income/tax.', href: '/sales/invoices/new' },
      { text: 'Qaado payment — cash kor, receivable hoos.', href: '/payments/new' },
      { text: 'Haddii Undeposited Funds, qor deposit marka bangiga gaadho.', href: '/banking/deposits/new' },
      { text: 'Celintu waa credit memo — ha beddelin invoice posted.', href: '/sales/credit-memos/new' },
    ],
  },
  {
    title: 'Iibsi, bilow ilaa dhamaad',
    steps: [
      { text: 'Bill = weli lagu leeyahay. Expense = horay loo bixiyey.', href: '/purchases/bills/new' },
      { text: 'Kharash = categories; alaab = items (kaliya items kayd dhaqaajiyaan).', href: '/purchases/bills/new' },
      { text: 'Bixi biilal ka Bill payments — hal payment biilal badan.', href: '/bill-payments/new' },
      { text: 'Vendor credit waxay yareysaa waxa aad ku leedahay.', href: '/purchases/vendor-credits/new' },
    ],
  },
  {
    title: 'Kaydka',
    steps: [
      { text: 'Kaliya “Inventory product” ayaa tirada xisaabiya.', href: '/items' },
      { text: 'Furitaan: quantity + cost → inventory vs Opening Balance Equity.', href: '/items' },
      { text: 'Kaydka cusub wuxuu yimaadaa bill/expense leh items.', href: '/purchases/bills/new' },
      { text: 'Farqi tirada = inventory adjustment.', href: '/inventory/adjustments/new' },
      { text: 'Iibinta item la raadraaco waxay dhaqaajisaa kayd + cost.', href: '/inventory/stock' },
    ],
  },
  {
    title: 'Bil kasta',
    steps: [
      { text: 'Import/reconcile bangiga.', href: '/banking/accounts' },
      { text: 'Ka shaqee close checklist Periods.', href: '/periods' },
      { text: 'Akhri profit & loss iyo balance sheet.', href: '/reports/profit-loss' },
      { text: 'Xir period-ka.', href: '/periods' },
    ],
  },
  {
    title: 'Sannad kasta',
    steps: [
      { text: 'Post adjusting journals (depreciation, accruals).', href: '/journals/new' },
      { text: 'Hubi adjusting entries report.', href: '/reports/adjusting-entries' },
      { text: 'Xir sannadka — faa’iido → Retained Earnings.', href: '/periods' },
    ],
  },
]

export default async function HelpGuideSoPage() {
  await requireOrgContext()
  const chapters = [...MANUAL_CHAPTERS].sort((a, b) => a.order - b.order)

  return (
    <>
      <PageHeader
        title="Hagitaan"
        description="Kala hormariska shaqada Soomaali. Magacyada badhamada screen-ka waa English."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Buug dhamaystiran:{' '}
        <Link href="/help/manual/so/intro" className="text-foreground underline underline-offset-4">
          Fur buugga Soomaaliga
        </Link>
        {' · '}
        <Link href="/help/guide" className="text-foreground underline underline-offset-4">
          English short guide
        </Link>
        {' · '}
        <Link href="/employees/guide" className="text-foreground underline underline-offset-4">
          Employees Guide
        </Link>
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Kala hormariska shaqada</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FLOWS.map((flow) => (
            <Card key={flow.title}>
              <CardHeader>
                <CardTitle className="text-base">{flow.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2.5 text-sm">
                  {flow.steps.map((step, index) => (
                    <li key={step.text} className="flex gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[0.6875rem] font-medium tabular">
                        {index + 1}
                      </span>
                      <span className="min-w-0 text-muted-foreground">
                        {step.text}
                        {step.href ? (
                          <>
                            {' '}
                            <Link href={step.href} className="text-foreground underline underline-offset-4">
                              Fur
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Cutubyada buugga</h2>
        <Card>
          <CardContent className="p-4">
            <ol className="columns-1 gap-8 space-y-1.5 text-sm sm:columns-2">
              {chapters.map((ch) => (
                <li key={ch.id} className="break-inside-avoid">
                  <Link
                    href={`/help/manual/so/${ch.id}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {ch.order}. {chapterTitle(ch, 'so')}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
