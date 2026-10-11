import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * An amount, coloured by its sign.
 *
 * Green and red are for the *unexpected*, not for good and bad. Every balance
 * here is shown on its account's natural side, so a positive figure is an
 * account behaving as its type says it should and a negative one is a contra
 * position — a bank account overdrawn, an expense account in credit, a customer
 * with a credit balance. Those are the ones worth finding on a page of numbers.
 *
 * Zero stays plain. A page where every row is coloured is a page where the
 * colour has stopped meaning anything.
 */
export function SignedMoney({
  amount,
  currency,
  className,
  emphasis = true,
  title,
}: {
  amount: Decimal | string | number
  currency: string
  className?: string
  /** Off where the whole column is signed and the weight would be noise. */
  emphasis?: boolean
  title?: string
}) {
  const value = amount instanceof Decimal ? amount : new Decimal(amount)
  const positive = value.greaterThan(0)
  const negative = value.lessThan(0)

  return (
    <span
      title={title}
      className={cn(
        'tabular',
        emphasis && (positive || negative) && 'font-semibold',
        positive && 'text-success',
        negative && 'text-destructive',
        className,
      )}
    >
      {formatMoney(value, currency)}
    </span>
  )
}
