// Service worker: abre la app sin conexión y recibe los avisos push.
importScripts('config.js');
const VERSION = 'v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon.svg'];
const API = (self.APP_CONFIG && self.APP_CONFIG.API_URL || '').replace(/\/$/, '');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Archivos de la app: primero la red (para recibir actualizaciones), si no hay conexión, la copia guardada.
// La API nunca se guarda en caché.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    // no-cache: siempre pregunta a GitHub Pages si hay versión nueva (si no cambió, responde rápido sin descargar).
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});

// El aviso llega sin texto; se lo pedimos a la API con nuestra propia suscripción.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch(API + '/api/push/pending', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (r.ok) items = await r.json();
      }
    } catch (err) { /* sin conexión: mostramos un aviso genérico */ }
    if (!items.length) items = [{ id: 'x', title: 'Control de Hoteles', body: 'Tienes un aviso nuevo. Abre la app para verlo.', url: '#/avisos' }];
    for (const n of items) {
      await self.registration.showNotification(n.title, {
        body: n.body, tag: 'n' + n.id, data: { url: n.url || '#/' },
        icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true,
      });
    }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL('./' + (e.notification.data?.url || ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  })());
});
