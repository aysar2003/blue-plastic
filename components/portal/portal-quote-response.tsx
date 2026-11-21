import { Button } from '@/components/ui/button'
import { respondToQuote } from '@/app/(portal)/portal/quotes/actions'

export function PortalQuoteResponse({
  id,
  status,
}: {
  id: string
  status: string
}) {
  if (status !== 'OPEN') {
    if (status === 'ACCEPTED') {
      return (
        <p className="text-sm text-muted-foreground">
          You accepted this quote. The company will follow up with an order or invoice.
        </p>
      )
    }
    if (status === 'DECLINED') {
      return <p className="text-sm text-muted-foreground">You declined this quote.</p>
    }
    if (status === 'CLOSED') {
      return (
        <p className="text-sm text-muted-foreground">
          This quote was converted — response is locked.
        </p>
      )
    }
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <form action={respondToQuote}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="accept" />
        <Button type="submit" size="sm">
          Accept quote
        </Button>
      </form>
      <form action={respondToQuote}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="decline" />
        <Button type="submit" size="sm" variant="outline">
          Decline
        </Button>
      </form>
    </div>
  )
}
