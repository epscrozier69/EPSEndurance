/* EPS Joliot Curie - Endurance : mode hors ligne
   Pages de l'appli : réseau d'abord (pour recevoir les mises à jour), copie locale si pas de réseau.
   Bibliothèque Excel : copie locale d'abord.
   Google (synchronisation, import) : jamais mis en cache. */
const CACHE = 'eps-endurance-v2';
const CORE = ['Endurance.html', 'manifest.json', 'icon.png'];
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    CORE.concat(LIBS).map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Secours : n'importe quelle page .html déjà gardée sur l'appareil */
function anyPage() {
  return caches.open(CACHE).then(c => c.keys().then(keys => {
    const k = keys.find(r => /\.html$/i.test(new URL(r.url).pathname));
    return k ? c.match(k) : undefined;
  }));
}

/* Réseau d'abord, mais sans attendre plus de 4 s (Wi-Fi sans internet : la requête peut rester bloquée) */
function networkFirst(req) {
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate'
      ? caches.match('Endurance.html', { ignoreSearch: true }).then(h => h || anyPage())
      : undefined));
  const net = fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  net.catch(() => {});
  const timeout = new Promise((_, ko) => setTimeout(ko, 4000));
  return Promise.race([net, timeout])
    .catch(() => fromCache().then(r => r || net))
    .catch(() => Response.error());
}

function cacheFirst(req) {
  return caches.match(req).then(r => r || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === 'cdnjs.cloudflare.com') e.respondWith(cacheFirst(req));
});
