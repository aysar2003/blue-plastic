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

const items = blocks(fs.readFileSync(path.join(dir, 'items.xml'), 'utf8'), 'ItemInventoryRet')
let withAvg = 0
let withQty = 0
let withCost = 0
let impliedInv = 0
const samples = []
for (const b of items) {
  const avg = Number(tag(b, 'AverageCost') || 0)
  const qty = Number(tag(b, 'QuantityOnHand') || 0)
  const cost = Number(tag(b, 'PurchaseCost') || 0)
  if (avg) withAvg++
  if (qty) withQty++
  if (cost) withCost++
  impliedInv += avg * qty
  if (samples.length < 5 && (qty || avg)) {
    samples.push({
      name: tag(b, 'FullName') || tag(b, 'Name'),
      qty,
      avg,
      cost,
      asset: tag(b.match(/<AssetAccountRef>[\s\S]*?<\/AssetAccountRef>/)?.[0] ?? '', 'FullName'),
    })
  }
}
console.log({ n: items.length, withAvg, withQty, withCost, impliedInv, samples })

const bills = []
const dirFiles = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith('bills-part') && f.endsWith('.xml'))
  .sort()
const xml = dirFiles.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
const billRets = blocks(xml, 'BillRet')
let itemLineAmt = 0
let itemLineN = 0
for (const b of billRets.slice(0, 3)) {
  console.log('--- bill sample ---', {
    ref: tag(b, 'RefNumber'),
    due: tag(b, 'AmountDue'),
    vendor: tag(b.match(/<VendorRef>[\s\S]*?<\/VendorRef>/)?.[0] ?? '', 'FullName'),
  })
  for (const l of blocks(b, 'ItemLineRet').slice(0, 4)) {
    console.log('  line', {
      item: tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
      qty: tag(l, 'Quantity'),
      cost: tag(l, 'Cost'),
      amt: tag(l, 'Amount'),
      acct: tag(l.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName'),
    })
  }
}
for (const b of billRets) {
  for (const l of blocks(b, 'ItemLineRet')) {
    itemLineN++
    itemLineAmt += Number(tag(l, 'Amount') || 0)
  }
}
console.log({ itemLineN, itemLineAmt })
