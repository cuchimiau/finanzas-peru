// Finanzas Perú · service worker: abre la app sin señal.
// - Páginas: primero la red (para recibir actualizaciones), si no hay señal, la copia guardada.
// - Archivos de la app (/assets con hash) y fuentes: primero la copia guardada.
// - Llamadas al Apps Script (Drive, Gemini): nunca se guardan.
const CACHE = 'finanzas-v1';
const SCOPE = new URL(self.registration.scope).pathname;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([SCOPE, SCOPE + 'manifest.webmanifest', SCOPE + 'icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(SCOPE, copy));
      return res;
    }).catch(() => caches.match(SCOPE)));
    return;
  }

  const sameApp = url.origin === location.origin && url.pathname.startsWith(SCOPE);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameApp && !fonts) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
