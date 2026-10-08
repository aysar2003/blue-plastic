import { ForgetMissingPlace } from '@/components/layout/app-memory'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed px-6 py-16 text-center">
      <ForgetMissingPlace />
      <p className="text-sm font-medium">Page not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        That page does not exist, or you do not have access to it.
      </p>
    </div>
  )
}
