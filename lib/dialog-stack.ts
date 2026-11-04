/**
 * Stack of open dialog closers (LIFO). Shell Back closes the top form first
 * and returns to the page / dialog underneath, instead of leaving the route.
 */

type Closer = {
  close: () => void
  /** False when the dialog unmounted or closed but left a stale stack entry. */
  live: () => boolean
}

const stack: Closer[] = []

/** Register while a dialog is mounted; returns unregister. */
export function registerDialogCloser(
  close: () => void,
  live: () => boolean = () => true,
): () => void {
  const entry: Closer = { close, live }
  stack.push(entry)
  return () => {
    const index = stack.lastIndexOf(entry)
    if (index >= 0) stack.splice(index, 1)
  }
}

/**
 * Close the topmost live dialog. True when one was closed.
 * Skips (and drops) stale closers so Back can still leave the page.
 */
export function closeTopDialog(): boolean {
  while (stack.length > 0) {
    const entry = stack.pop()
    if (!entry) return false
    if (!entry.live()) continue
    entry.close()
    return true
  }
  return false
}

export function openDialogCount(): number {
  return stack.filter((entry) => entry.live()).length
}

/** Tests only. */
export function resetDialogStack() {
  stack.length = 0
}
