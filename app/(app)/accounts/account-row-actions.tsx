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
import { setAccountActive } from '@/app/(app)/accounts/actions'
import {
  EditAccountDialog,
  type AccountFormValues,
  type ParentOption,
} from '@/app/(app)/accounts/account-dialog'

type AccountRow = AccountFormValues & { isActive: boolean; subtype: AccountSubtype }

const RECONCILABLE = new Set<AccountSubtype>(['BANK', 'CREDIT_CARD'])
const MONEY = new Set<AccountSubtype>(['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS'])

/**
 * Account row: click opens the register; ⋯ opens actions (transfer, edit,
 * quick report, active/inactive) — same pattern as QuickBooks.
 */
export function AccountTableRow({
  account,
  parents,
  canEdit,
  canArchive,
  canReport,
  canReconcile,
  canTransact,
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
  canTransact?: boolean
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
    const width = 260
    const height = 360
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

  const isMoney = MONEY.has(account.subtype)
  const showReconcile = canReconcile && RECONCILABLE.has(account.subtype) && account.isActive
  const showInactive = canArchive && !account.isSystem
  const showTransfer = Boolean(canTransact) && isMoney && account.isActive
  const showDeposit =
    Boolean(canTransact) &&
    account.isActive &&
    (account.subtype === 'BANK' || account.subtype === 'CREDIT_CARD')

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
      <TableCell className="print:hidden">
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
              className="fixed z-50 min-w-60 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
              style={{ left: point.x, top: point.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <MenuItem onSelect={() => go(`/accounts/${account.id}`)}>
                View all transactions
              </MenuItem>
              {canReport ? (
                <MenuItem
                  onSelect={() => go(`/reports/transaction-detail?account=${account.id}`)}
                >
                  Quick report
                </MenuItem>
              ) : null}
              {showTransfer || showDeposit || showReconcile ? (
                <div className="my-1 h-px bg-border" />
              ) : null}
              {showTransfer ? (
                <MenuItem onSelect={() => go(`/banking/transfers/new?from=${account.id}`)}>
                  Transfer
                </MenuItem>
              ) : null}
              {showDeposit ? (
                <MenuItem onSelect={() => go(`/banking/deposits/new?bank=${account.id}`)}>
                  Make a deposit
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
              {canEdit ? (
                <MenuItem
                  onSelect={() => {
                    setPoint(null)
                    setEditing(true)
                  }}
                >
                  Edit account
                </MenuItem>
              ) : null}
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
