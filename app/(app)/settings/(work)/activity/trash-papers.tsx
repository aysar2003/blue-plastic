'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { attachTrashFile, deleteTrashFile } from './actions'

type Paper = {
  id: string
  originalName: string
  contentType: string
  byteSize: number
  createdAt: string
}

export function TrashPapers({ auditLogId, files }: { auditLogId: string; files: Paper[] }) {
  const router = useRouter()

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h2 className="text-sm font-semibold">Upload papers</h2>
          <p className="text-sm text-muted-foreground">
            Works for every deleted transaction — invoice, quotation, sales receipt, bill, expense,
            payment, transfer, deposit, stock adjustment, and the rest. Attach the PDF you downloaded,
            a scan, or any supporting file. The company books stay clean; the papers stay here.
          </p>
        </div>

        <form
          action={async (formData) => {
            const result = await attachTrashFile(formData)
            if (!result.ok) {
              toast.error(result.error.message)
              return
            }
            toast.success(
              result.data.count === 1 ? 'Paper attached.' : `${result.data.count} papers attached.`,
            )
            router.refresh()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="auditLogId" value={auditLogId} />
          <label className="text-sm">
            <span className="mb-1 block font-medium">Files (PDF or image)</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              required
              className="block text-xs"
            />
          </label>
          <Button type="submit" size="sm">
            Upload
          </Button>
        </form>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No papers yet.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  href={`/api/trash/${auditLogId}/files/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {file.originalName}
                </a>
                <span className="text-xs text-muted-foreground">
                  {Math.max(1, Math.round(file.byteSize / 1024))} KB
                </span>
                <button
                  type="button"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  onClick={() => {
                    void deleteTrashFile({ auditLogId, fileId: file.id }).then((result) => {
                      if (!result.ok) toast.error(result.error.message)
                      else {
                        toast.success('Paper removed.')
                        router.refresh()
                      }
                    })
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
