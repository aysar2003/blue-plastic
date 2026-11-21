import { normaliseHeader } from '@/lib/csv'

export type StatementPackId = 'generic' | 'so' | 'ke'

export type StatementFormatPack = {
  id: StatementPackId
  label: string
  /** Normalised source header → canonical statement column. */
  columns: Record<string, string>
}

/**
 * Column mapping presets for common Horn / East Africa bank CSVs.
 * Canonical names match `statement-import.service` pick() aliases.
 */
export const STATEMENT_FORMAT_PACKS: StatementFormatPack[] = [
  {
    id: 'generic',
    label: 'Generic (date / amount / description)',
    columns: {},
  },
  {
    id: 'so',
    label: 'Somalia (Salaam / Premier / Dahabshiil)',
    columns: {
      valuedate: 'date',
      txndate: 'date',
      transdate: 'date',
      postingdate: 'date',
      narration: 'description',
      particulars: 'description',
      remarks: 'description',
      details: 'description',
      dr: 'debit',
      withdrawal: 'debit',
      moneyout: 'debit',
      cr: 'credit',
      deposit: 'credit',
      moneyin: 'credit',
      refno: 'reference',
      chequeno: 'reference',
      trxno: 'externalId',
    },
  },
  {
    id: 'ke',
    label: 'Kenya (KCB / Equity / M-Pesa)',
    columns: {
      transactiondate: 'date',
      completiontime: 'date',
      transdate: 'date',
      valuedate: 'date',
      details: 'description',
      transactiondetails: 'description',
      description: 'description',
      paidin: 'credit',
      moneyin: 'credit',
      withdrawn: 'debit',
      moneyout: 'debit',
      paidout: 'debit',
      receiptno: 'externalId',
      transactionid: 'externalId',
      receiptnumber: 'externalId',
    },
  },
]

export function statementFormatPackById(id: string | null | undefined): StatementFormatPack {
  const found = STATEMENT_FORMAT_PACKS.find((pack) => pack.id === id)
  return found ?? STATEMENT_FORMAT_PACKS[0]!
}

/** Rewrite a header using a pack map; unknown headers stay as-is. */
export function remapStatementHeader(header: string, pack: StatementFormatPack): string {
  const mapped = pack.columns[normaliseHeader(header)]
  return mapped ?? header
}

/**
 * Apply a pack's column map to a parsed CSV row so generic pick() aliases work.
 * Copies mapped values onto canonical keys without dropping originals.
 */
export function applyStatementPackRow(
  row: Record<string, string>,
  pack: StatementFormatPack,
): Record<string, string> {
  if (pack.id === 'generic' || Object.keys(pack.columns).length === 0) return row
  const next = { ...row }
  for (const [source, canonical] of Object.entries(pack.columns)) {
    const value = row[source]
    if (value !== undefined && value !== '' && !next[normaliseHeader(canonical)]) {
      next[normaliseHeader(canonical)] = value
    }
  }
  return next
}
