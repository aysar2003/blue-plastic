'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardListIcon, FileCheck2Icon, Loader2Icon, ReceiptIcon } from 'lucide-react'
import { toast } from 'sonner'

import { convertSalesDocument } from '@/app/(app)/sales/actions'
import { AccountPicker } from '@/components/forms/account-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AccountPickerOption } from '@/lib/account-options'
import { byType } from '@/lib/sales-types'
import type { SalesDocumentType } from '@prisma/client'

type ConvertTarget = 'INVOICE' | 'SALES_RECEIPT' | 'SALES_ORDER'

const TARGET_HREF: Record<ConvertTarget, string> = {
  INVOICE: '/sales/invoices',
  SALES_RECEIPT: '/sales/sales-receipts',
  SALES_ORDER: '/sales/sales-orders',
}

/**
 * QuickBooks-style fulfill actions on an estimate, quotation, or sales order:
 * Create invoice, Sales receipt, and (from a proposal) Sales order.
 */
export function ConvertSalesDocumentActions({
  id,
  number,
  sourceType,
  today,
  depositAccounts,
  variant = 'default',
  compact = false,
}: {
  id: string
  number: string
  sourceType: Extract<SalesDocumentType, 'ESTIMATE' | 'QUOTATION' | 'SALES_ORDER'>
  today: string
  depositAccounts: AccountPickerOption[]
  variant?: 'default' | 'outline' | 'ghost'
  compact?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [depositAccountId, setDepositAccountId] = useState(depositAccounts[0]?.id ?? '')
  const proposal = sourceType === 'ESTIMATE' || sourceType === 'QUOTATION'

  const fulfill = (target: ConvertTarget, accountId?: string) => {
    startTransition(async () => {
      const result = await convertSalesDocument({
        id,
        date: today,
        target,
        depositAccountId: target === 'SALES_RECEIPT' ? accountId || null : null,
      })
      if (result.ok) {
        const kind = byType(result.data.type).singular
        toast.success(`${kind} ${result.data.number} created from ${number}.`)
        setReceiptOpen(false)
        router.push(`${TARGET_HREF[result.data.type]}/${result.data.id}`)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={variant}
          disabled={isPending}
          title={`Create an invoice from ${number}`}
          onClick={() => fulfill('INVOICE')}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <FileCheck2Icon />}
          {compact ? 'Invoice' : 'Create invoice'}
        </Button>
        <Button
          size="sm"
          variant={variant === 'default' ? 'outline' : variant}
          disabled={isPending}
          title={`Create a sales receipt from ${number}`}
          onClick={() => {
            setDepositAccountId(depositAccounts[0]?.id ?? '')
            setReceiptOpen(true)
          }}
        >
          <ReceiptIcon />
          {compact ? 'Receipt' : 'Sales receipt'}
        </Button>
        {proposal ? (
          <Button
            size="sm"
            variant={variant === 'default' ? 'outline' : variant}
            disabled={isPending}
            title={`Create a sales order from ${number}`}
            onClick={() => fulfill('SALES_ORDER')}
          >
            <ClipboardListIcon />
            {compact ? 'Order' : 'Sales order'}
          </Button>
        ) : null}
      </span>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Collect as sales receipt</DialogTitle>
            <DialogDescription>
              {number} becomes a paid sale. Choose where the money was received.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="fulfill-deposit" className="text-sm font-medium">
              Deposit to
            </label>
            <AccountPicker
              id="fulfill-deposit"
              options={depositAccounts}
              value={depositAccountId || null}
              onChange={(next) => setDepositAccountId(next ?? '')}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setReceiptOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !depositAccountId}
              onClick={() => fulfill('SALES_RECEIPT', depositAccountId)}
            >
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              Create sales receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Invoice-only convert — prefer ConvertSalesDocumentActions when deposit accounts are available. */
export function ConvertEstimateButton({
  id,
  number,
  today,
  variant = 'default',
  label = 'Create invoice',
}: {
  id: string
  number: string
  today: string
  variant?: 'default' | 'outline' | 'ghost'
  label?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={isPending}
      title={`Create an invoice with the same items and prices as ${number}`}
      onClick={() =>
        startTransition(async () => {
          const result = await convertSalesDocument({ id, date: today, target: 'INVOICE' })
          if (result.ok) {
            toast.success(`Invoice ${result.data.number} created from ${number}.`)
            router.push(`/sales/invoices/${result.data.id}`)
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <FileCheck2Icon />}
      {label}
    </Button>
  )
}

/** Sales order → invoice or receipt. */
export function FulfillSalesOrderActions(
  props: Omit<React.ComponentProps<typeof ConvertSalesDocumentActions>, 'sourceType'>,
) {
  return <ConvertSalesDocumentActions {...props} sourceType="SALES_ORDER" />
}
