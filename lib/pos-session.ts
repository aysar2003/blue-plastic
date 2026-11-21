import { Decimal, ZERO } from '@/lib/money'

export function sessionExpectedCash(input: {
  opening: string | Decimal
  cashIn: string | Decimal
  cashOut: string | Decimal
  cashSales: string | Decimal
  cashRefunds: string | Decimal
  payouts?: string | Decimal | null
}): string {
  const opening = new Decimal(input.opening.toString())
  const cashIn = new Decimal(input.cashIn.toString())
  const cashOut = new Decimal(input.cashOut.toString())
  const cashSales = new Decimal(input.cashSales.toString())
  const cashRefunds = new Decimal(input.cashRefunds.toString())
  const payouts = input.payouts != null && input.payouts !== '' ? new Decimal(input.payouts.toString()) : ZERO
  return opening.plus(cashIn).minus(cashOut).minus(payouts).plus(cashSales).minus(cashRefunds).toFixed(4)
}

export function sessionCashVariance(counted: string | Decimal, expected: string | Decimal): string {
  return new Decimal(counted.toString()).minus(new Decimal(expected.toString())).toFixed(4)
}

export function sessionPnlSummary(input: {
  sales: string | Decimal
  refunds: string | Decimal
  cashVariance?: string | Decimal | null
}): { sales: string; refunds: string; netSales: string; cashVariance: string } {
  const sales = new Decimal(input.sales.toString())
  const refunds = new Decimal(input.refunds.toString())
  const cashVariance =
    input.cashVariance != null && input.cashVariance !== ''
      ? new Decimal(input.cashVariance.toString())
      : ZERO
  return {
    sales: sales.toFixed(4),
    refunds: refunds.toFixed(4),
    netSales: sales.minus(refunds).toFixed(4),
    cashVariance: cashVariance.toFixed(4),
  }
}
