const CACHE = 'vivum-v2';

// Только тяжёлые файлы которые не меняются
const IMMUTABLE = [
  '/engine/core.js',
  '/engine/ui.js',
  '/engine/vivum.module.wasm',
  '/assets/bliss.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(IMMUTABLE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isImmutable = IMMUTABLE.some(p => url.pathname === p);

  if (isImmutable) {
    // Отдаём из кеша, не идём в сеть
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
  // JS/CSS/HTML — всегда свежие из сети
});
