// Service worker: offline app shell only (#296, #479).
//
// The cache scope is deliberately narrow. Only the offline shell, icons and
// content-hashed build output are stored. Member-scoped API responses, RSC
// payloads (`?_rsc=`) and cross-origin responses (IPFS gateways, the indexer)
// are never intercepted, so nothing that identifies a member — or grows once
// per navigation — is written to Cache Storage.
//
// The cache is named after the build: registration appends `?v=<build id>`, so
// a deploy installs a worker with a new name, and activate deletes the old one.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE_PREFIX = 'ourdao-'
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`
const OFFLINE_URL = '/'
const PRECACHE = [
  OFFLINE_URL,
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/icon-maskable-512x512.png',
]

// A deploy can add chunks faster than the old ones are deleted, so the static
// cache is capped; oldest entries are dropped first.
const MAX_STATIC_ENTRIES = 80

/** Build output and icons — content-hashed or tiny, and never member data. */
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/apple-touch-icon') ||
    pathname === '/manifest.json'
  )
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/** Store a response, then trim the cache back to its cap. */
async function putBounded(request, response) {
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response)
  const keys = await cache.keys()
  if (keys.length <= MAX_STATIC_ENTRIES) return
  const excess = keys.slice(0, keys.length - MAX_STATIC_ENTRIES)
  await Promise.all(excess.map((key) => cache.delete(key)))
}

// Install: precache the offline shell and icons.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// Activate: drop this app's caches from earlier builds.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Another origin: IPFS gateways, the indexer, Stellar RPC. Not ours to store.
  if (url.origin !== self.location.origin) return
  // Authenticated / member-specific JSON must never reach the cache: on a
  // shared device the previous member's data would then be served offline.
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network-first, falling back to the precached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match(OFFLINE_URL)
        return shell || offlineResponse()
      })
    )
    return
  }

  // Everything else (RSC payloads, route handlers, documents) is left alone.
  if (!isStaticAsset(url.pathname)) return

  // Static assets: cache-first, then network, storing what came back.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) putBounded(request, response.clone())
        return response
      })
    })
  )
})
