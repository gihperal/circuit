// Guarda o app no celular: abre na hora, mesmo sem internet ou com sinal ruim.
// Mostra a cópia guardada e, ao mesmo tempo, busca a versão nova para a próxima abertura.
// Também recebe os avisos do Circuit Live.
const CACHE = 'circuit-v7';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res;
    })));
    return;
  }
  if (url.pathname.endsWith('/config.json')) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res;
    }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => {
      if (res && res.ok) c.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => hit || c.match('./index.html'));
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })));
});

// Avisos do Circuit Live
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { b: e.data ? e.data.text() : '' }; }
  const acoes = Array.isArray(d.acoes) ? d.acoes.map(a => ({ action: a.a, title: a.t })) : [];
  e.waitUntil(self.registration.showNotification(d.t || 'Circuit', {
    body: d.b || '', icon: 'icon-192.png', badge: 'badge-96.png', tag: d.tag || 'circuit', renotify: true,
    data: d, actions: acoes, lang: 'pt-BR'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  if (e.action === 'adiar') {
    if (d.live) e.waitUntil(fetch(d.live + '/adiar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: d.g, id: d.dev }) }).catch(() => {}));
    return;
  }
  const destino = e.action === 'comecar' ? './#comecar' : e.action === 'juntas' ? './#juntas' : (d.u || './');
  const url = new URL(destino, self.registration.scope).href, hash = new URL(url).hash;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const c of lista) {
      if ('focus' in c) { c.postMessage({ tipo: 'abrir', hash }); return c.focus(); }
    }
    return clients.openWindow(url);
  }));
});
