'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { importChartForm } from './actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ImportChartButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import a chart</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A CSV from Excel with columns code, name, type, subtype, and optionally detail,
            openingBalance, openingBalanceDate. Type is ASSET, LIABILITY, EQUITY, REVENUE or EXPENSE.
            Subtype is the detail type, such as INCOME or OPERATING_EXPENSE.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => setCsv(String(reader.result ?? ''))
              reader.readAsText(file)
            }}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button
              disabled={pending || csv === ''}
              onClick={() =>
                startTransition(async () => {
                  const result = await importChartForm({ csv })
                  if (!result.ok) {
                    toast.error(result.error.message)
                    return
                  }
                  toast.success(`${result.data.created} accounts added.`)
                  setOpen(false)
                  router.refresh()
                })
              }
            >
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
