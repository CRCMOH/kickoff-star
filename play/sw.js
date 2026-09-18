// Kickoff Star service worker — app-shell caching for installable, offline
// play. The game is fully local (IndexedDB saves), so once the shell is
// cached the whole game works with no network at all.
//
// Strategy:
//  - navigations: network-first, falling back to the cached shell (offline)
//  - hashed build assets (/assets/*): cache-first (immutable by filename)
//  - everything else same-origin: stale-while-revalidate
const CACHE = 'kickoff-star-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? caches.match('/index.html')))
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy))
        return res
      }))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy))
        return res
      }).catch(() => cached)
      return cached ?? network
    })
  )
})
