/* Service worker OculoSaaS — rend l'app installable (PWA) et utilisable hors-ligne.
 * Stratégie sûre : navigation = network-first (jamais de HTML périmé),
 * assets hashés = cache-first. L'API (cross-origin) n'est jamais interceptée. */
const CACHE = 'oculosaas-v4';

/**
 * Installation : met en cache TOUTE l'application (liste produite au build,
 * /precache.json), pour que chaque écran s'ouvre hors ligne — y compris ceux
 * jamais visités, chargés à la demande.
 *
 * Un fichier qui ne se télécharge pas n'empêche pas l'installation : mieux vaut
 * une application presque entièrement disponible hors ligne que pas de mise à
 * jour du tout sur une connexion mobile capricieuse.
 */
async function precacheApp() {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch('/precache.json', { cache: 'no-store' });
    if (!res.ok) return;
    const files = await res.json();
    await Promise.all(
      ['/index.html', ...files].map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
      ),
    );
  } catch {
    /* Hors ligne à l'installation : les fichiers seront mis en cache à l'usage. */
  }
}

// Active immédiatement la nouvelle version (pas d'attente que tous les onglets
// ferment) ; combiné à clients.claim(), la MAJ s'applique sans délai.
self.addEventListener('install', (event) => {
  event.waitUntil(precacheApp().then(() => self.skipWaiting()));
});
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

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
