'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArchiveIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { archiveFiscalYear, restoreFiscalYear } from './actions'

type ArchivedRow = {
  id: string
  year: number
  archivedAt: string
  canRestore: boolean
}

export function YearArchiveCard({
  liveFromYear,
  currentFiscalYear,
  liveWindowYears,
  nextToArchive,
  archived,
  canManage,
}: {
  liveFromYear: number
  currentFiscalYear: number
  liveWindowYears: number
  nextToArchive: { id: string; year: number } | null
  archived: ArchivedRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Archive &amp; restore</p>
      <p className="text-sm text-muted-foreground">
        Keeping FY {liveFromYear}–{currentFiscalYear} live ({liveWindowYears} years). Older closed
        years can leave the hot ledger one year at a time; restore brings them back newest-first.
      </p>

      {canManage && nextToArchive ? (
        confirmArchive ? (
          <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
            <p>
              This removes detail for FY {nextToArchive.year} from live books. The balance sheet stays
              correct via an opening bridge. You can restore later.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await archiveFiscalYear({ fiscalYearId: nextToArchive.id })
                    if (result.ok) {
                      toast.success(`Fiscal year ${result.data.year} archived.`)
                      setConfirmArchive(false)
                      router.refresh()
                    } else {
                      toast.error(result.error.message)
                    }
                  })
                }
              >
                {isPending ? <Loader2Icon className="animate-spin" /> : <ArchiveIcon />}
                Archive FY {nextToArchive.year}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmArchive(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
            <ArchiveIcon /> Archive next year (FY {nextToArchive.year})
          </Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          No year is ready to archive. Close years older than the live window first.
        </p>
      )}

      {archived.length > 0 ? (
        <ul className="space-y-2 border-t pt-3 text-sm">
          {archived.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                FY {row.year}
                <span className="ml-2 text-muted-foreground">
                  archived {new Date(row.archivedAt).toLocaleDateString()}
                </span>
              </span>
              {canManage && row.canRestore ? (
                confirmRestoreId === row.id ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await restoreFiscalYear({ fiscalYearId: row.id })
                          if (result.ok) {
                            toast.success(`Fiscal year ${result.data.year} restored.`)
                            setConfirmRestoreId(null)
                            router.refresh()
                          } else {
                            toast.error(result.error.message)
                          }
                        })
                      }
                    >
                      {isPending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                      Restore FY {row.year}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setConfirmRestoreId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRestoreId(row.id)}>
                    <RotateCcwIcon /> Restore
                  </Button>
                )
              ) : row.canRestore ? null : (
                <span className="text-xs text-muted-foreground">Restore newer years first</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
