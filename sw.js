/**
 * Service worker for the EMAM EXPRESS PWA wrapper.
 *
 * Scope is deliberately narrow: this caches only the wrapper SHELL
 * (this HTML page, the manifest, the icons) so the app opens instantly
 * even on a slow connection. It never caches anything from the Apps
 * Script domain — that's live financial data (balances, transactions,
 * rates), and serving a stale cached copy of that would be actively
 * wrong, not just an inconvenience. The iframe inside always goes
 * straight to the network.
 *
 * Bump CACHE_VERSION any time you update the shell files (icons,
 * manifest, this wrapper's own HTML/CSS) so returning users get the
 * new version instead of a stale cached one.
 */
const CACHE_VERSION = 'emam-express-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellFile = url.origin === self.location.origin;

  if (!isShellFile) {
    // Anything not part of this wrapper (the Apps Script iframe, live
    // rate lookups, etc.) — always go straight to the network.
    return;
  }

  // Shell files: try cache first for instant load, fall back to network,
  // and refresh the cache in the background so the next install picks up
  // changes without needing a manual version bump every time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
