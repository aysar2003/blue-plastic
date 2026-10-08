'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { addStandardCategories } from '@/app/(app)/items/actions'
import { Button } from '@/components/ui/button'

/** Adds the standard merchandise groups the organisation does not have yet. */
export function StandardCategoriesButton({ missing }: { missing: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addStandardCategories({})
          if (result.ok) {
            toast.success(
              result.data.added === 0
                ? 'Standard categories are already in place.'
                : `Added ${result.data.added} standard categor${result.data.added === 1 ? 'y' : 'ies'}.`,
            )
            router.refresh()
          } else {
            toast.error(result.error.message)
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
      Add standard categories ({missing})
    </Button>
  )
}
