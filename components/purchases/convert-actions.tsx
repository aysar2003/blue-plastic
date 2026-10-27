'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardListIcon, FileCheck2Icon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { convertPurchaseDocument } from '@/app/(app)/purchases/actions'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { purchaseByType } from '@/lib/purchase-types'
import type { PurchaseDocumentType } from '@prisma/client'

type VendorOption = { id: string; label: string; email?: string | null }

const TARGET_HREF: Record<'RFQ' | 'PURCHASE_ORDER', string> = {
  RFQ: '/purchases/rfqs',
  PURCHASE_ORDER: '/purchases/purchase-orders',
}

/**
 * Purchase request → RFQ or purchase order, and RFQ → purchase order.
 * A vendor is required on the document that goes to the supplier.
 */
export function ConvertPurchaseDocumentActions({
  id,
  number,
  sourceType,
  today,
  vendors,
  initialVendorId,
  variant = 'default',
}: {
  id: string
  number: string
  sourceType: Extract<PurchaseDocumentType, 'PURCHASE_REQUEST' | 'RFQ'>
  today: string
  vendors: VendorOption[]
  initialVendorId?: string | null
  variant?: 'default' | 'outline' | 'ghost'
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [vendorOpen, setVendorOpen] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<'RFQ' | 'PURCHASE_ORDER'>('RFQ')
  const [vendorId, setVendorId] = useState(initialVendorId ?? '')

  const fulfill = (target: 'RFQ' | 'PURCHASE_ORDER', chosenVendor?: string) => {
    startTransition(async () => {
      const result = await convertPurchaseDocument({
        id,
        date: today,
        target,
        vendorId: chosenVendor || initialVendorId || null,
      })
      if (result.ok) {
        const kind = purchaseByType(result.data.type).singular
        toast.success(`${kind} ${result.data.number} created from ${number}.`)
        setVendorOpen(false)
        router.push(`${TARGET_HREF[result.data.type]}/${result.data.id}`)
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const start = (target: 'RFQ' | 'PURCHASE_ORDER') => {
    if (!initialVendorId) {
      setPendingTarget(target)
      setVendorId('')
      setVendorOpen(true)
      return
    }
    fulfill(target, initialVendorId)
  }

  return (
    <>
      {sourceType === 'PURCHASE_REQUEST' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          title={`Create an RFQ from ${number}`}
          onClick={() => start('RFQ')}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <ClipboardListIcon />}
          Create RFQ
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={variant}
        disabled={isPending}
        title={`Create a purchase order from ${number}`}
        onClick={() => start('PURCHASE_ORDER')}
      >
        {isPending ? <Loader2Icon className="animate-spin" /> : <FileCheck2Icon />}
        Create purchase order
      </Button>

      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {pendingTarget === 'RFQ' ? 'Create RFQ' : 'Create purchase order'}
            </DialogTitle>
            <DialogDescription>
              {number} goes to one vendor. Choose who receives it. The price is theirs to state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="convert-vendor" className="text-sm font-medium">
              Vendor
            </label>
            <EntityPicker
              id="convert-vendor"
              kind="vendor"
              options={vendors}
              value={vendorId || null}
              onChange={(next) => setVendorId(next ?? '')}
              placeholder="Choose a vendor"
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setVendorOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || !vendorId} onClick={() => fulfill(pendingTarget, vendorId)}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              {pendingTarget === 'RFQ' ? 'Create RFQ' : 'Create purchase order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
