type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let listening = false

function ensureInstallListener() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
  })
}

export function canPromptPosInstall(): boolean {
  ensureInstallListener()
  return deferredPrompt != null
}

export async function promptPosInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  ensureInstallListener()
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  deferredPrompt = null
  await prompt.prompt()
  const choice = await prompt.userChoice
  return choice.outcome
}

export function registerPosServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return
  void navigator.serviceWorker.register('/sw-pos.js').catch(() => {
    // Ignore — private mode / blocked SW.
  })
}

/** Call once from the till so beforeinstallprompt is captured early. */
export function watchPosInstallPrompt(): () => void {
  ensureInstallListener()
  return () => {}
}
