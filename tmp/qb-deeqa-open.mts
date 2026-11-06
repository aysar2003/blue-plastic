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

const invoices = blocks(readAll('invoices'), 'InvoiceRet')
const deeqa = invoices.filter((b) => cust(b).toUpperCase() === 'DEEQA CONSTRACTION')
console.log('deeqa invoices in QB', deeqa.length)

const rows = deeqa.map((b) => ({
  n: tag(b, 'RefNumber') || tag(b, 'TxnNumber'),
  date: tag(b, 'TxnDate'),
  total: money(tag(b, 'Subtotal') || tag(b, 'TotalAmount') || '0'),
  balance: money(tag(b, 'BalanceRemaining') || '0'),
  paid: tag(b, 'IsPaid') === 'true',
  lines: blocks(b, 'InvoiceLineRet').length,
}))
const open = rows.filter((r) => r.balance > 0.004 || !r.paid)
const paid = rows.filter((r) => r.paid || r.balance <= 0.004)
console.log('open count', open.length, 'paid count', paid.length)
console.log(
  'open sum balance',
  open.reduce((s, r) => s + r.balance, 0).toFixed(2),
  'open sum total',
  open.reduce((s, r) => s + r.total, 0).toFixed(2),
)
console.log(
  'all balance remaining sum',
  rows.reduce((s, r) => s + r.balance, 0).toFixed(2),
)
console.log(
  'open sample',
  open
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30)
    .map((r) => `${r.date} ${r.n} total=${r.total} bal=${r.balance} lines=${r.lines}`),
)

const payments = blocks(readAll('payments'), 'ReceivePaymentRet').filter(
  (b) => cust(b).toUpperCase() === 'DEEQA CONSTRACTION',
)
console.log('deeqa payments', payments.length)
for (const p of payments.slice(0, 15)) {
  const apps = blocks(p, 'AppliedToTxnRet').map((a) => ({
    type: tag(a, 'TxnType'),
    ref: tag(a, 'RefNumber'),
    amt: money(tag(a, 'Amount') || '0'),
  }))
  console.log({
    date: tag(p, 'TxnDate'),
    ref: tag(p, 'RefNumber'),
    total: money(tag(p, 'TotalAmount') || '0'),
    apps,
  })
}

// customer balance from customers.xml
const customers = blocks(fs.readFileSync(path.join(dir, 'customers.xml'), 'utf8'), 'CustomerRet')
for (const c of customers) {
  const name = tag(c, 'Name') || tag(c, 'FullName')
  if (!name.toUpperCase().includes('DEEQA')) continue
  console.log('customer bal', name, {
    Balance: tag(c, 'Balance'),
    TotalBalance: tag(c, 'TotalBalance'),
  })
}
