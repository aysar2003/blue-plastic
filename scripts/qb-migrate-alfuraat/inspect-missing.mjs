import fs from 'node:fs'
import path from 'node:path'

const dirs = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const dir = dirs.find((d) => fs.existsSync(path.join(d, 'accounts.xml')))
console.log('dir', dir)

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
const blocks = (xml, name) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
const readAll = (prefix) =>
  fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')

const needed = [
  'MUSHAAR',
  'BANK',
  'Rent Expense',
  'Sales',
  'HANTIDA GUUD:ABDIRAHMAAN',
  'HANTIDA GUUD:AHMED SALAD',
  'Insurance Expense',
  'XAMALI',
  'Auto and Truck Expenses',
  'Freight Costs',
  'Computer and Internet Expenses',
  'witing',
  'XAMALI:KIRO GAARI',
  'Payroll Expenses',
  'COMMOSION',
  'CASH DEQA KU MAQAN',
]

const ax = fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8')
const all = blocks(ax, 'AccountRet').map((b) => ({
  full: tag(b, 'FullName') || tag(b, 'Name'),
  name: tag(b, 'Name'),
  type: tag(b, 'AccountType'),
  number: tag(b, 'AccountNumber'),
  balance: tag(b, 'Balance'),
}))
console.log('QB accounts total', all.length)
for (const n of needed) {
  const hit = all.find(
    (a) =>
      a.full.toLowerCase() === n.toLowerCase() ||
      a.name.toLowerCase() === n.toLowerCase() ||
      a.full.toLowerCase().endsWith(':' + n.toLowerCase()),
  )
  console.log(n, '=>', hit || 'NOT IN accounts.xml')
}

const inv = blocks(readAll('invoices'), 'InvoiceRet')
const target = inv.find((b) => (tag(b, 'RefNumber') || tag(b, 'TxnNumber')) === '1228')
if (!target) console.log('1228 not found')
else {
  console.log('--- invoice 1228 ---')
  console.log({
    customer: tag(target.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName'),
    date: tag(target, 'TxnDate'),
    subtotal: tag(target, 'Subtotal'),
    IsPaid: tag(target, 'IsPaid'),
  })
  const lines = blocks(target, 'InvoiceLineRet')
  console.log('lines', lines.length)
  for (const l of lines.slice(0, 8)) {
    console.log({
      item: tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
      qty: tag(l, 'Quantity'),
      rate: tag(l, 'Rate'),
      amt: tag(l, 'Amount'),
      desc: (tag(l, 'Desc') || '').slice(0, 80),
    })
  }
}

for (const n of ['10097', '212084', '20665']) {
  const b = blocks(readAll('bills'), 'BillRet').find((x) => (tag(x, 'RefNumber') || tag(x, 'TxnNumber')) === n)
  if (!b) {
    console.log('bill', n, 'missing from xml')
    continue
  }
  const items = blocks(b, 'ItemLineRet')
  const exps = blocks(b, 'ExpenseLineRet')
  console.log('--- bill', n, '---', {
    vendor: tag(b.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? '', 'FullName'),
    date: tag(b, 'TxnDate'),
    items: items.length,
    exps: exps.length,
    amountDue: tag(b, 'AmountDue'),
  })
  for (const l of items.slice(0, 5)) {
    console.log('  item', {
      item: tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
      qty: tag(l, 'Quantity'),
      amt: tag(l, 'Amount'),
    })
  }
  for (const l of exps.slice(0, 5)) {
    console.log('  exp', {
      acct: tag(l.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName'),
      amt: tag(l, 'Amount'),
    })
  }
}

// Why no-line invoices?
let noLine = 0
let zeroQty = 0
let descOnly = 0
for (const b of inv) {
  const lines = blocks(b, 'InvoiceLineRet')
  const withItem = lines.filter((l) => tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'))
  if (!withItem.length) {
    noLine++
    if (lines.length) descOnly++
  } else if (withItem.every((l) => Number(tag(l, 'Quantity') || '0') <= 0)) {
    zeroQty++
  }
}
console.log({ noLine, descOnly, zeroQty, totalInv: inv.length })
