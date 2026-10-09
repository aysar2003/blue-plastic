import 'server-only'

import { isRenderableForbiddenStore } from '@/lib/access-denied'

type WorkStore = {
  phase?: string
  url?: { pathname?: string }
}

function readStore(): { phase?: string; pathname?: string } | null {
  try {
    // Loaded only while a request is rendering. A static import pulls the Next
    // internals into unit tests that merely construct an AppError.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('next/dist/server/app-render/work-unit-async-storage.external') as {
      workUnitAsyncStorage?: { getStore?: () => WorkStore | undefined }
    }
    const store = mod.workUnitAsyncStorage?.getStore?.()
    if (!store) return null
    return { phase: store.phase, pathname: store.url?.pathname }
  } catch {
    return null
  }
}

function disabledInterrupt(error: unknown): boolean {
  return error instanceof Error && error.message.includes('authInterrupts')
}

/**
 * During a page render, hand the denial to `forbidden.tsx` so the shell stays
 * and the dev overlay does not treat a missing permission as a crash.
 * Actions and `/api` routes fall through and keep the `AppError` result.
 */
export function interruptForbiddenPage(): void {
  if (process.env.VITEST) return
  if (!isRenderableForbiddenStore(readStore())) return

  let interrupt: (() => never) | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    interrupt = (require('next/navigation') as typeof import('next/navigation')).forbidden
  } catch {
    return
  }

  try {
    interrupt()
  } catch (error) {
    if (disabledInterrupt(error)) return
    throw error
  }
}
