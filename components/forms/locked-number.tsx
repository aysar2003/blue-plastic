import { Field } from '@/components/forms/field'
import { Input } from '@/components/ui/input'

/**
 * The number a transaction will carry. It starts as the next one in order, and
 * it can be typed over — a plain number jumps the sequence, any other text is
 * kept as written. The database id, once the row exists, stays hidden.
 */
export function LockedNumber({
  label,
  value,
  onChange,
  error,
  recordId,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string[]
  recordId?: string
}) {
  return (
    <Field
      name="number"
      label={label}
      error={error}
      hint="Type the number you want, or leave the next one. The one after it follows in order."
    >
      <Input
        id="number"
        name="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tabular"
        maxLength={40}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      {recordId ? <input type="hidden" name="recordId" value={recordId} /> : null}
    </Field>
  )
}
