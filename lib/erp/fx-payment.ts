import { Decimal, ZERO } from '@/lib/money'

/**
 * Realised FX on settling a foreign document.
 *
 * Bank is converted at the **payment-date** rate. AR/AP carrying is the
 * document-date rate × foreign applied. Residual is realised gain/loss.
 */
export function realisedFxResidual(input: {
  foreignAmount: Decimal.Value
  paymentDateRate: Decimal.Value
  applications: { foreignAmount: Decimal.Value; documentRate: Decimal.Value }[]
}): { bankBase: Decimal; controlBase: Decimal; residual: Decimal } {
  const foreign = new Decimal(input.foreignAmount)
  const payRate = new Decimal(input.paymentDateRate)
  const bankBase = foreign.times(payRate)

  let controlBase = ZERO
  let applied = ZERO
  for (const application of input.applications) {
    const f = new Decimal(application.foreignAmount)
    applied = applied.plus(f)
    controlBase = controlBase.plus(f.times(application.documentRate))
  }
  const unapplied = foreign.minus(applied)
  if (unapplied.greaterThan(0)) {
    controlBase = controlBase.plus(unapplied.times(payRate))
  }

  return {
    bankBase,
    controlBase,
    residual: bankBase.minus(controlBase),
  }
}

/**
 * Payment-date rate: table rate for that date wins; otherwise the rate entered
 * on the payment. Same-currency is always 1.
 */
export function pickPaymentDateRate(input: {
  baseCurrency: string
  paymentCurrency: string
  enteredRate?: Decimal.Value | null
  tableRate?: Decimal.Value | null
}): Decimal {
  if (input.paymentCurrency.toUpperCase() === input.baseCurrency.toUpperCase()) {
    return new Decimal(1)
  }
  if (input.tableRate != null && input.tableRate !== '') {
    const table = new Decimal(input.tableRate)
    if (table.greaterThan(0)) return table
  }
  if (input.enteredRate != null && input.enteredRate !== '') {
    const entered = new Decimal(input.enteredRate)
    if (entered.greaterThan(0)) return entered
  }
  return new Decimal(1)
}
