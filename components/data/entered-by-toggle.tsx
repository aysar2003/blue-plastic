'use client'

import { useEffect, useState } from 'react'
import { Columns3Icon } from 'lucide-react'

const KEY = 'bpc.showEnteredBy'

/** Shows or hides the Entered by column on transaction lists. The choice is kept on this browser. */
export function EnteredByToggle() {
  const [shown, setShown] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setShown(window.localStorage.getItem(KEY) !== '0')
    setReady(true)
  }, [])

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-column="entered-by"]').forEach((cell) => {
      cell.hidden = !shown
    })
    if (ready) window.localStorage.setItem(KEY, shown ? '1' : '0')
  }, [shown, ready])

  return (
    <label className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm print:hidden">
      <Columns3Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <input
        type="checkbox"
        checked={shown}
        onChange={(event) => setShown(event.target.checked)}
        className="size-3.5 accent-[#2ca01c]"
      />
      Entered by
    </label>
  )
}
