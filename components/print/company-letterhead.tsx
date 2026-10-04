import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { cn } from '@/lib/utils'

/** Company name, address, phone, and email. Prints with the page. */
export function CompanyLetterhead({
  organization,
  className,
}: {
  organization: LetterheadSource
  className?: string
}) {
  const block = letterheadOf(organization)
  return (
    <div className={cn('text-sm', className)}>
      <p className="text-base font-semibold">{block.name}</p>
      {block.address ? <p className="text-muted-foreground">{block.address}</p> : null}
      {block.phone ? <p className="text-muted-foreground">Phone {block.phone}</p> : null}
      {block.email ? <p className="text-muted-foreground">Email {block.email}</p> : null}
    </div>
  )
}
