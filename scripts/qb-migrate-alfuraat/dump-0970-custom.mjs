import fs from 'node:fs'
import path from 'node:path'

const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
function blocks(xml, name) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}

const xml = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith('invoices-custom-part') && f.endsWith('.xml'))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n')

for (const block of blocks(xml, 'InvoiceRet')) {
  if ((tag(block, 'RefNumber') || tag(block, 'TxnNumber')) !== '0970') continue
  // Strip line items for header dump
  const header = block.replace(/<InvoiceLineRet>[\s\S]*?<\/InvoiceLineRet>/g, '')
  const tags = [...header.matchAll(/<([A-Za-z0-9]+)>([^<]*)<\/\1>/g)].map((m) => [m[1], m[2]])
  console.log(JSON.stringify({ tags, headerLen: header.length, headerSnippet: header.slice(0, 2500) }, null, 2))
}
