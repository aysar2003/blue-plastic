import fs from 'node:fs'
import path from 'node:path'

const dir = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
].find((d) => fs.existsSync(path.join(d, 'accounts.xml')))
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

const ax = fs.readFileSync(path.join(dir, 'accounts.xml'), 'utf8')
const accts = blocks(ax, 'AccountRet').map((b) => ({
  full: tag(b, 'FullName') || tag(b, 'Name'),
  type: tag(b, 'AccountType'),
  bal: Number(tag(b, 'Balance') || 0),
}))
const cust = blocks(fs.readFileSync(path.join(dir, 'customers.xml'), 'utf8'), 'CustomerRet').map((b) => ({
  name: tag(b, 'FullName') || tag(b, 'Name'),
  bal: Number(tag(b, 'Balance') || 0),
}))
const vend = blocks(fs.readFileSync(path.join(dir, 'vendors.xml'), 'utf8'), 'VendorRet').map((b) => ({
  name: tag(b, 'FullName') || tag(b, 'Name'),
  bal: Number(tag(b, 'Balance') || 0),
}))
const ar = accts.find((a) => a.type === 'AccountsReceivable')
const ap = accts.find((a) => a.type === 'AccountsPayable')
console.log({
  ar,
  customerBalSum: cust.reduce((s, c) => s + c.bal, 0),
  customers: cust.filter((c) => c.bal),
  ap,
  vendorBalSum: vend.reduce((s, v) => s + v.bal, 0),
  vendors: vend.filter((v) => v.bal),
})
let dr = 0
let cr = 0
const debitTypes = new Set(['Bank', 'AccountsReceivable', 'OtherCurrentAsset', 'FixedAsset', 'OtherAsset', 'CostOfGoodsSold', 'Expense', 'OtherExpense'])
for (const a of accts) {
  if (a.bal === 0) continue
  if (debitTypes.has(a.type)) {
    if (a.bal >= 0) dr += a.bal
    else cr += -a.bal
  } else {
    if (a.bal >= 0) cr += a.bal
    else dr += -a.bal
  }
}
console.log({ dr, cr, diff: dr - cr, acctCount: accts.length })
