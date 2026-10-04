'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { AccountSubtype } from '@prisma/client'

import { StartReconciliationButton } from '@/components/banking/start-reconciliation'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { setAccountActive } from './actions'
import { EditAccountDialog, type AccountFormValues, type ParentOption } from './account-dialog'

type AccountRow = AccountFormValues & { isActive: boolean; subtype: AccountSubtype }

const RECONCILABLE = new Set<AccountSubtype>(['BANK', 'CREDIT_CARD'])

/**
 * Right-click (and the row button) for one account.
 *
 * What is offered follows the books: a system account cannot be made inactive,
 * because the engine posts to it by name; an account is never deleted, because
 * a posted line has to keep its name; reconcile is only for a bank or a card.
 */
export function AccountTableRow({
  account,
  parents,
  canEdit,
  canArchive,
  canReport,
  canReconcile,
  today,
  className,
  children,
}: {
  account: AccountRow
  parents: ParentOption[]
  canEdit: boolean
  canArchive: boolean
  canReport: boolean
  canReconcile: boolean
  today: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!point) return
    const close = () => setPoint(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [point])

  const openAt = (x: number, y: number) => {
    const width = 240
    const height = 280
    setPoint({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    })
  }

  const go = (href: string) => {
    setPoint(null)
    router.push(href)
  }

  const toggle = () => {
    setPoint(null)
    startTransition(async () => {
      const result = await setAccountActive({ id: account.id, isActive: !account.isActive })
      if (result.ok) {
        toast.success(account.isActive ? 'Account made inactive.' : 'Account made active.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const showReconcile = canReconcile && RECONCILABLE.has(account.subtype) && account.isActive
  const showInactive = canArchive && !account.isSystem

  return (
    <TableRow
      title={`Open ${account.name}`}
      className={cn('cursor-pointer hover:bg-muted/50', className)}
      onContextMenu={(event) => {
        event.preventDefault()
        openAt(event.clientX, event.clientY)
      }}
      onClick={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('a, button, input, select, textarea, summary, details, label')) return
        router.push(`/accounts/${account.id}`)
      }}
    >
      {children}
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Actions for ${account.name}`}
          onClick={(event) => {
            event.stopPropagation()
            const box = event.currentTarget.getBoundingClientRect()
            openAt(box.right, box.bottom)
          }}
        >
          <MoreHorizontalIcon />
        </Button>
      </TableCell>

      {point
        ? createPortal(
            <div
              role="menu"
              className="fixed z-50 min-w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
              style={{ left: point.x, top: point.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <MenuItem onSelect={() => go(`/accounts/${account.id}`)}>View register</MenuItem>
              {canReport ? (
                <MenuItem
                  onSelect={() =>
                    go(`/reports/transaction-detail?account=${account.id}`)
                  }
                >
                  Run report
                </MenuItem>
              ) : null}
              {showReconcile ? (
                <MenuItem
                  onSelect={() => {
                    setPoint(null)
                    setReconciling(true)
                  }}
                >
                  Reconcile
                </MenuItem>
              ) : null}
              {canEdit || showInactive ? <div className="my-1 h-px bg-border" /> : null}
              {canEdit ? <MenuItem onSelect={() => { setPoint(null); setEditing(true) }}>Edit</MenuItem> : null}
              {showInactive ? (
                <MenuItem tone={account.isActive ? 'danger' : 'default'} onSelect={toggle}>
                  {account.isActive ? 'Make inactive' : 'Make active'}
                </MenuItem>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {editing ? (
        <EditAccountDialog account={account} parents={parents} onClose={() => setEditing(false)} />
      ) : null}
      {reconciling ? (
        <StartReconciliationButton
          startOpen
          accountId={account.id}
          accountName={account.name}
          today={today}
          onClose={() => setReconciling(false)}
        />
      ) : null}
    </TableRow>
  )
}

function MenuItem({
  children,
  onSelect,
  tone = 'default',
}: {
  children: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={
        tone === 'danger'
          ? 'flex w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10'
          : 'flex w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent'
      }
      onClick={onSelect}
    >
      {children}
    </button>
  )
}
