import { Decimal, formatMoney, formatSigned } from '@/lib/money'

/**
 * Customer-facing labels for an AR balance (debit − credit on their account).
 *
 * Positive = they owe the company (debit balance).
 * Negative = the company owes them / credit on account (credit balance).
 * Zero = settled.
 */
export function describeCustomerBalance(balance: Decimal.Value, currency: string) {
  const amount = new Decimal(balance)
  const absolute = formatMoney(amount.abs(), currency)
  const signed = formatSigned(amount, currency)

  if (amount.isZero()) {
    return {
      side: 'settled' as const,
      title: 'Account balance',
      amountLabel: absolute,
      signedLabel: signed,
      explanation: 'Your account is settled — nothing is owed either way.',
      debitLabel: absolute,
      creditLabel: formatMoney(0, currency),
    }
  }

  if (amount.isPositive()) {
    return {
      side: 'debit' as const,
      title: 'Debit balance — you owe',
      amountLabel: absolute,
      signedLabel: signed,
      explanation:
        'Debit means invoices and charges on your account. This is what you still owe.',
      debitLabel: absolute,
      creditLabel: formatMoney(0, currency),
    }
  }

  return {
    side: 'credit' as const,
    title: 'Credit balance — on your side',
    amountLabel: absolute,
    signedLabel: signed,
    explanation:
      'Credit means payments or credit memos exceed open invoices. This amount is in your favour.',
    debitLabel: formatMoney(0, currency),
    creditLabel: absolute,
  }
}
