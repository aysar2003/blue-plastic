'use client'

import { useSyncExternalStore } from 'react'

import { LUXURY_POS, ODOO, type PosBrand } from '@/lib/odoo-brand'

function subscribe(onStoreChange: () => void) {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        onStoreChange()
        return
      }
    }
  })
  observer.observe(root, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getSnapshot(): PosBrand {
  return document.documentElement.classList.contains('luxury') ? LUXURY_POS : ODOO
}

function getServerSnapshot(): PosBrand {
  return ODOO
}

/** Live POS chrome — champagne when html.luxury, else navy/cyan. */
export function usePosBrand(): PosBrand {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
