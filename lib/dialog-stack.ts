/**
 * Stack of open dialog closers (LIFO). Shell Back closes the top form first
 * and returns to the page / dialog underneath, instead of leaving the route.
 */

type Closer = () => void

const stack: Closer[] = []

/** Register while a dialog is mounted; returns unregister. */
export function registerDialogCloser(close: Closer): () => void {
  stack.push(close)
  return () => {
    const index = stack.lastIndexOf(close)
    if (index >= 0) stack.splice(index, 1)
  }
}

/** Close the topmost dialog. True when one was closed. */
export function closeTopDialog(): boolean {
  const close = stack.pop()
  if (!close) return false
  close()
  return true
}

export function openDialogCount(): number {
  return stack.length
}

/** Tests only. */
export function resetDialogStack() {
  stack.length = 0
}
