/* Virtual Electronics Lab — offline service worker (PWA / GitHub Pages / iOS).
 *
 * The shipped copy of this file (release/PWA) has its asset list filled in by
 * scripts/package-pwa.cjs, so the whole lab — HTML, JS, CSS, icons and the
 * Rust/WASM engine — is downloaded once while installing and then runs with no
 * network at all. The placeholder below keeps the dev build valid.
 */
const CACHE = 'vlab-1.0.5';
const INDEX = new URL('./index.html', self.location.href).href;
const ROOT = new URL('./', self.location.href).href;

const SHELL = [ROOT, INDEX, new URL('./manifest.webmanifest', self.location.href).href];
const GENERATED = [
  "./assets/index-B9AKmJUc.css",
  "./assets/index-Dnsk9PKY.js",
  "./assets/vlab_engine_bg-DHFBlFGD.wasm",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./index.html",
  "./manifest.webmanifest"
];
const PRECACHE = [...SHELL, ...(GENERATED[0] === '__PRECACHE_LIST__' ? [] : GENERATED)];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

// Cache-first for the packaged app assets, network-first only for page
// navigations so a newly deployed build is picked up on the next visit.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(INDEX, fresh.clone());
          return fresh;
        } catch {
          const cached = (await caches.match(INDEX)) || (await caches.match(ROOT));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Same-origin assets (JS, CSS, WASM, icons): cache first — offline first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Google Fonts and any other cross-origin asset: keep a copy so the installed
  // home-screen app still renders with its own typography with no network.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
