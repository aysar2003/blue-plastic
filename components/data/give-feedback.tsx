import Link from 'next/link'
import { MessageSquareIcon } from 'lucide-react'

/** Opens the help desk. Feedback is a person reading it, not a stored ledger row. */
export function GiveFeedback({ className }: { className?: string }) {
  return (
    <Link
      href="/help"
      className={className ?? 'inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'}
    >
      <MessageSquareIcon className="size-4" />
      Give feedback
    </Link>
  )
}
