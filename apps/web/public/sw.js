/* Service worker OculoSaaS — rend l'app installable (PWA) et utilisable hors-ligne.
 * Stratégie sûre : navigation = network-first (jamais de HTML périmé),
 * assets hashés = cache-first. L'API (cross-origin) n'est jamais interceptée. */
const CACHE = 'oculosaas-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // laisse passer l'API et les CDN

  // Pages (navigation) : réseau d'abord, repli sur le cache (hors-ligne).
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('/index.html', res.clone());
          return res;
        } catch {
          return (await caches.match('/index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau (puis mise en cache).
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (
          res.ok &&
          (url.pathname.startsWith('/assets/') ||
            /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname))
        ) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
