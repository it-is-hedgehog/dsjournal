// DS Journal — Service Worker
const CACHE_NAME = 'dsjournal-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // journal.json — всегда сначала сеть (данные должны быть свежими),
  // кеш — только как fallback при офлайне.
  if (url.includes('data/journal.json')) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // остальные ассеты — stale-while-revalidate (UI грузится мгновенно из кеша)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
