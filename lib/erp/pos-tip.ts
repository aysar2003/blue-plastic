import { Decimal } from '@/lib/money'

/**
 * Split a POS tender into sale / tip / change without double-counting tip on the
 * sales journal. Sale payments must still sum to the sale due.
 */
export function splitPosTender(input: {
  saleDue: Decimal.Value
  tipAmount: Decimal.Value
  tenderTotal: Decimal.Value
}):
  | { ok: true; saleDue: Decimal; tip: Decimal; change: Decimal }
  | { ok: false; message: string } {
  const saleDue = new Decimal(input.saleDue)
  const tip = new Decimal(input.tipAmount)
  const tender = new Decimal(input.tenderTotal)

  if (saleDue.isNegative()) return { ok: false, message: 'Sale total cannot be negative.' }
  if (tip.isNegative()) return { ok: false, message: 'Tip cannot be negative.' }
  if (tender.lessThan(saleDue.plus(tip).minus(0.00005))) {
    return {
      ok: false,
      message: `Tender must cover sale (${saleDue.toFixed(2)}) plus tip (${tip.toFixed(2)}).`,
    }
  }

  return {
    ok: true,
    saleDue,
    tip,
    change: tender.minus(saleDue).minus(tip),
  }
}
