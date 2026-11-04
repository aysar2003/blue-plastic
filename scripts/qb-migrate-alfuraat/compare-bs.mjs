process.loadEnvFile('.env')
import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const dirs = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const dir = dirs.find((d) => fs.existsSync(path.join(d, 'accounts.xml')))
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
const qb = blocks(ax, 'AccountRet').map((b) => ({
  full: tag(b, 'FullName') || tag(b, 'Name'),
  name: tag(b, 'Name'),
  type: tag(b, 'AccountType'),
  balance: Number(tag(b, 'Balance') || '0'),
  totalBalance: Number(tag(b, 'TotalBalance') || tag(b, 'Balance') || '0'),
}))

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})
const org = await db.organization.findFirst({
  where: { name: { equals: 'AL FURAAT MATERIALS', mode: 'insensitive' } },
})

const rows = await db.$queryRaw`
  SELECT a.id, a.code, a.name, a.type, a.subtype,
         COALESCE(SUM(CASE WHEN j.status NOT IN ('DRAFT','DELETED') THEN jl.debit ELSE 0 END), 0)::text AS debit,
         COALESCE(SUM(CASE WHEN j.status NOT IN ('DRAFT','DELETED') THEN jl.credit ELSE 0 END), 0)::text AS credit
  FROM ledger_accounts a
  LEFT JOIN journal_lines jl ON jl."accountId" = a.id AND jl."orgId" = a."orgId"
  LEFT JOIN journals j ON j.id = jl."journalId"
  WHERE a."orgId" = ${org.id}
  GROUP BY a.id
  ORDER BY a.code
`

const debitNormal = new Set(['ASSET', 'COGS', 'EXPENSE'])
const erp = rows.map((r) => {
  const d = Number(r.debit)
  const c = Number(r.credit)
  const natural = debitNormal.has(r.type) ? d - c : c - d
  return { ...r, debit: d, credit: c, natural }
})

const erpByName = new Map()
for (const a of erp) {
  erpByName.set(a.name.toLowerCase(), a)
  if (a.name.includes(':')) erpByName.set(a.name.split(':').pop().trim().toLowerCase(), a)
}

const aliases = {
  'rent expense': 'rent',
  sales: 'sales — plastic products',
  'freight costs': 'freight & duty — inbound',
  'payroll expenses': 'salaries & wages',
  'accounts receivable': 'accounts receivable',
  'accounts payable': 'accounts payable',
  'inventory asset': 'inventory asset',
  'retained earnings': 'retained earnings',
  utilities: 'utilities',
  'office supplies': 'office supplies',
  'professional fees': 'professional fees',
  'depreciation expense': 'depreciation expense',
  'cost of goods sold': 'cost of goods sold',
}

console.log('=== QB accounts vs ERP natural balance ===')
const mismatches = []
let qbAsset = 0,
  qbLiab = 0,
  qbEq = 0,
  qbInc = 0,
  qbExp = 0
for (const a of qb) {
  const t = a.type
  if (t === 'Bank' || t === 'AccountsReceivable' || t === 'OtherCurrentAsset' || t === 'FixedAsset' || t === 'OtherAsset')
    qbAsset += a.balance
  else if (t === 'AccountsPayable' || t === 'CreditCard' || t === 'OtherCurrentLiability' || t === 'LongTermLiability')
    qbLiab += a.balance
  else if (t === 'Equity') qbEq += a.balance
  else if (t === 'Income' || t === 'OtherIncome') qbInc += a.balance
  else if (t === 'Expense' || t === 'OtherExpense' || t === 'CostOfGoodsSold') qbExp += a.balance

  const key = a.full.toLowerCase()
  const leaf = a.name.toLowerCase()
  const hit =
    erpByName.get(key) || erpByName.get(leaf) || erpByName.get(aliases[key]) || erpByName.get(aliases[leaf])
  const erpBal = hit ? hit.natural : null
  const diff = erpBal == null ? 'MISSING' : Number((erpBal - a.balance).toFixed(2))
  if (diff !== 0 && diff !== '0' && Math.abs(Number(diff) || 999) > 0.01) {
    mismatches.push({
      qb: a.full,
      type: a.type,
      qbBal: a.balance,
      erpName: hit?.name ?? null,
      erpBal,
      diff,
    })
  }
}

console.log(JSON.stringify({ mismatches, qbCounts: qb.length, erpCounts: erp.length }, null, 2))
console.log('\n=== QB totals (AccountRet.Balance) ===')
console.log({ qbAsset, qbLiab, qbEq, qbInc, qbExp, qbRE: qbInc - qbExp, qbEquityPlusRE: qbEq + (qbInc - qbExp) })

const erpAsset = erp.filter((a) => a.type === 'ASSET').reduce((s, a) => s + a.natural, 0)
const erpLiab = erp.filter((a) => a.type === 'LIABILITY').reduce((s, a) => s + a.natural, 0)
const erpEq = erp.filter((a) => a.type === 'EQUITY').reduce((s, a) => s + a.natural, 0)
const erpRev = erp.filter((a) => a.type === 'REVENUE').reduce((s, a) => s + a.natural, 0)
const erpCogs = erp.filter((a) => a.type === 'COGS').reduce((s, a) => s + a.natural, 0)
const erpExp = erp.filter((a) => a.type === 'EXPENSE').reduce((s, a) => s + a.natural, 0)
console.log('\n=== ERP totals ===')
console.log({
  erpAsset,
  erpLiab,
  erpEq,
  erpRev,
  erpCogs,
  erpExp,
  profit: erpRev - erpCogs - erpExp,
  equityPlusProfit: erpEq + (erpRev - erpCogs - erpExp),
})

console.log('\n=== ERP accounts with balance (nonzero) ===')
for (const a of erp.filter((x) => Math.abs(x.natural) > 0.005)) {
  console.log(`${a.code}\t${a.type}\t${a.natural.toFixed(2)}\t${a.name}`)
}

await db.$disconnect()
