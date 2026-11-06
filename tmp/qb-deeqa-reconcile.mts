import fs from 'node:fs'
import path from 'node:path'

const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'

function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1]!.trim() : ''
}
function blocks(xml: string, name: string) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}
function readAll(prefix: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}
function money(raw: string) {
  const n = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
function cust(block: string) {
  const ref = block.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? ''
  return tag(ref, 'FullName')
}

const NAME = 'DEEQA CONSTRACTION'
const invoices = blocks(readAll('invoices'), 'InvoiceRet').filter((b) => cust(b) === NAME)
const payments = blocks(readAll('payments'), 'ReceivePaymentRet').filter((b) => cust(b) === NAME)
const journals = blocks(readAll('journals'), 'JournalEntryRet')

let invCharge = 0
let invOpen = 0
for (const b of invoices) {
  invCharge += money(tag(b, 'Subtotal') || tag(b, 'TotalAmount') || '0')
  invOpen += money(tag(b, 'BalanceRemaining') || '0')
}
let payTotal = 0
let payApplied = 0
let payUnapplied = 0
for (const b of payments) {
  const total = money(tag(b, 'TotalAmount') || '0')
  payTotal += total
  const apps = blocks(b, 'AppliedToTxnRet')
  let applied = 0
  for (const a of apps) applied += money(tag(a, 'Amount') || '0')
  payApplied += applied
  payUnapplied += total - applied
}

// Journal lines mentioning this customer
let jeDebit = 0
let jeCredit = 0
const jeHits: { n: string; date: string; d: number; c: number; memo: string }[] = []
for (const b of journals) {
  const n = tag(b, 'TxnNumber') || tag(b, 'RefNumber')
  const date = tag(b, 'TxnDate')
  const memo = tag(b, 'Memo')
  for (const line of blocks(b, 'JournalLineRet')) {
    const entity = tag(line.match(/<EntityRef>[\s\S]*?<\/EntityRef>/)?.[0] ?? '', 'FullName')
    if (entity !== NAME) continue
    const d = money(tag(line, 'DebitAmount') || '0')
    const c = money(tag(line, 'CreditAmount') || '0')
    jeDebit += d
    jeCredit += c
    jeHits.push({ n, date, d, c, memo })
  }
}

console.log({
  invCount: invoices.length,
  invCharge: invCharge.toFixed(2),
  invOpen: invOpen.toFixed(2),
  payCount: payments.length,
  payTotal: payTotal.toFixed(2),
  payApplied: payApplied.toFixed(2),
  payUnapplied: payUnapplied.toFixed(2),
  jeDebit: jeDebit.toFixed(2),
  jeCredit: jeCredit.toFixed(2),
  naiveNet: (invCharge - payTotal + jeDebit - jeCredit).toFixed(2),
  openMinusUnapplied: (invOpen - payUnapplied).toFixed(2),
  qbCustomerBalance: 111823.35,
})
console.log('je hits', jeHits.length, jeHits.slice(0, 20))

// AR account balance in accounts.xml
const accounts = blocks(fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8'), 'AccountRet')
for (const a of accounts) {
  const t = tag(a, 'AccountType')
  if (t !== 'AccountsReceivable') continue
  console.log('AR account', tag(a, 'FullName') || tag(a, 'Name'), tag(a, 'Balance'))
}
