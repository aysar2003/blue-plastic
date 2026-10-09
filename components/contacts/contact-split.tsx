'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { cn } from '@/lib/utils'

const MIN = 176
const MAX = 520
const DEFAULT = 256

type DetailPanelContextValue = {
  open: boolean
  hide: () => void
  show: () => void
  toggle: () => void
}

const DetailPanelContext = createContext<DetailPanelContextValue | null>(null)

/** Hide / show the customer or vendor information pane (list expands when closed). */
export function useContactDetailPanel() {
  const value = useContext(DetailPanelContext)
  if (!value) {
    throw new Error('useContactDetailPanel must be used inside ContactSplit')
  }
  return value
}

export function useOptionalContactDetailPanel() {
  return useContext(DetailPanelContext)
}

/**
 * Left list / right detail, with a drag handle between them — the same gesture
 * as widening a column in Excel. Width is remembered per screen. The detail
 * pane can be closed so the name list fills the row.
 */
export function ContactSplit({
  storageKey,
  detailStorageKey,
  left,
  right,
}: {
  storageKey: string
  /** Remembers whether Customer / Vendor information is visible. */
  detailStorageKey: string
  left: ReactNode
  right: ReactNode
}) {
  const shell = useRef<HTMLDivElement>(null)
  const widthRef = useRef(DEFAULT)
  const storedWidth = useBrowserStore(storageKey)
  const [width, setWidth] = useState(DEFAULT)
  const [appliedWidth, setAppliedWidth] = useState<string | null>(null)
  if (storedWidth !== appliedWidth) {
    setAppliedWidth(storedWidth)
    const next = Number(storedWidth)
    if (storedWidth && Number.isFinite(next)) setWidth(clamp(next))
  }
  const [dragging, setDragging] = useState(false)
  const detailOpen = useBrowserStore(detailStorageKey) !== '0'

  useEffect(() => {
    widthRef.current = width
  }, [width])

  const persistDetail = useCallback(
    (next: boolean) => {
      writeBrowserStore(detailStorageKey, next ? '1' : '0')
    },
    [detailStorageKey],
  )

  const detailApi: DetailPanelContextValue = {
    open: detailOpen,
    hide: () => persistDetail(false),
    show: () => persistDetail(true),
    toggle: () => persistDetail(!detailOpen),
  }

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const box = shell.current?.getBoundingClientRect()
      if (!box) return
      const next = clamp(event.clientX - box.left)
      widthRef.current = next
      setWidth(next)
    }

    const onUp = () => {
      setDragging(false)
      writeBrowserStore(storageKey, String(widthRef.current))
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, storageKey])

  const persist = (next: number) => {
    const clamped = clamp(next)
    widthRef.current = clamped
    setWidth(clamped)
    writeBrowserStore(storageKey, String(clamped))
  }

  return (
    <DetailPanelContext.Provider value={detailApi}>
      <div ref={shell} className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'flex min-h-0 flex-col',
            detailOpen ? 'shrink-0 border-r' : 'min-w-0 flex-1',
          )}
          style={detailOpen ? { width } : undefined}
        >
          {left}
        </aside>

        {detailOpen ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize list and detail"
              aria-valuemin={MIN}
              aria-valuemax={MAX}
              aria-valuenow={Math.round(width)}
              tabIndex={0}
              onPointerDown={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  persist(widthRef.current - 16)
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  persist(widthRef.current + 16)
                }
              }}
              className={cn(
                'group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent',
                'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border',
                'hover:after:w-0.5 hover:after:bg-primary/60 focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-primary',
                dragging && 'after:w-0.5 after:bg-primary',
              )}
            >
              <span className="pointer-events-none absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
          </>
        ) : null}
      </div>
    </DetailPanelContext.Provider>
  )
}

function clamp(value: number) {
  return Math.min(MAX, Math.max(MIN, value))
}
