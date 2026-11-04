import fs from 'node:fs'
import path from 'node:path'

const dir = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
].find((d) => fs.existsSync(path.join(d, 'items.xml')))

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
const refName = (block, wrap) => tag(block.match(new RegExp(`<${wrap}>[\\s\\S]*?</${wrap}>`))?.[0] ?? '', 'FullName')

const itemKinds = [
  'ItemInventoryRet',
  'ItemNonInventoryRet',
  'ItemServiceRet',
  'ItemOtherChargeRet',
  'ItemDiscountRet',
]
const income = new Map()
const expense = new Map()
const cogs = new Map()
const asset = new Map()
const types = {}
const ix = readAll('items')
let itemN = 0
for (const k of itemKinds) {
  for (const b of blocks(ix, k)) {
    itemN++
    types[k] = (types[k] || 0) + 1
    const bump = (map, v) => map.set(v, (map.get(v) || 0) + 1)
    bump(income, refName(b, 'IncomeAccountRef') || '(none)')
    bump(expense, refName(b, 'ExpenseAccountRef') || '(none)')
    bump(cogs, refName(b, 'COGSAccountRef') || '(none)')
    bump(asset, refName(b, 'AssetAccountRef') || '(none)')
  }
}
console.log('items', itemN, types)
console.log('income', [...income.entries()].sort((a, b) => b[1] - a[1]))
console.log('expense', [...expense.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
console.log('cogs', [...cogs.entries()].sort((a, b) => b[1] - a[1]))
console.log('asset', [...asset.entries()].sort((a, b) => b[1] - a[1]))

const payDep = new Map()
let pmtN = 0
let pmtAmt = 0
for (const b of blocks(readAll('payments'), 'ReceivePaymentRet')) {
  pmtN++
  pmtAmt += Number(tag(b, 'TotalAmount') || 0)
  const d = refName(b, 'DepositToAccountRef') || '(none)'
  payDep.set(d, (payDep.get(d) || 0) + 1)
}
console.log('payments', pmtN, 'amt', pmtAmt, 'depositTo', [...payDep.entries()])

const bpAcct = new Map()
let bpN = 0
let bpAmt = 0
const bpSample = []
const bpXml = readAll('bill-payments')
const bpKinds = ['BillPaymentCheckRet', 'BillPaymentCreditCardRet']
for (const k of bpKinds) {
  for (const b of blocks(bpXml, k)) {
    bpN++
    const amt = Number(tag(b, 'Amount') || 0)
    bpAmt += amt
    const bank = refName(b, 'BankAccountRef') || refName(b, 'CreditCardAccountRef') || '(none)'
    bpAcct.set(bank, (bpAcct.get(bank) || 0) + 1)
    if (bpSample.length < 3) bpSample.push({ k, vendor: refName(b, 'PayeeEntityRef'), bank, amt, date: tag(b, 'TxnDate') })
  }
}
console.log('billPayments', bpN, 'amt', bpAmt, 'accounts', [...bpAcct.entries()], 'sample', bpSample)

// invoice totals vs AR
let invAmt = 0
let invN = 0
for (const b of blocks(readAll('invoices'), 'InvoiceRet')) {
  invN++
  invAmt += Number(tag(b, 'Subtotal') || 0)
}
console.log('invoices', invN, 'subtotal', invAmt)

let billAmt = 0
let billN = 0
let expAccts = new Map()
for (const b of blocks(readAll('bills'), 'BillRet')) {
  billN++
  billAmt += Number(tag(b, 'AmountDue') || 0)
  for (const line of blocks(b, 'ExpenseLineRet')) {
    const a = refName(line, 'AccountRef') || '(none)'
    expAccts.set(a, (expAccts.get(a) || 0) + 1)
  }
}
console.log('bills', billN, 'amountDue', billAmt, 'expenseLineAccounts', [...expAccts.entries()].slice(0, 20))

console.log('files', fs.readdirSync(dir).filter((f) => /payment|deposit|check|credit/i.test(f)))
