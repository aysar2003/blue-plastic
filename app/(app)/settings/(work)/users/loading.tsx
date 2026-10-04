import { TableSkeleton } from '@/components/data/table-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-8 w-28" />
      </div>
      <TableSkeleton columns={5} />
    </div>
  )
}
