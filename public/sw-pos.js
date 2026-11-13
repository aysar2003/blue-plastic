/* SOM ERP POS service worker — caches the POS shell only. */
const CACHE = 'som-pos-shell-v1'
const PRECACHE = ['/pos', '/icons/pos-icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

function isPosNavigation(request, url) {
  if (request.mode !== 'navigate') return false
  return url.pathname === '/pos' || url.pathname.startsWith('/pos/')
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Never cache API, auth, or server actions.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/sign-in')
  ) {
    return
  }

  if (isPosNavigation(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/pos', copy).catch(() => undefined))
          return response
        })
        .catch(async () => {
          const cached = (await caches.match('/pos')) || (await caches.match(request))
          if (cached) return cached
          return new Response('SOM ERP POS is offline. Reopen the till after reconnecting.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }),
    )
    return
  }

  // Same-origin static assets used by an open till: cache-first after network.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => undefined))
            }
            return response
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})
