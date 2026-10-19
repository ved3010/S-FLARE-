const CACHE_NAME = 'solflare-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: cache shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    // API requests: network only
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { status: 503 })));
  } else {
    // Static assets: cache-first
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

// Push notifications
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data?.json() || {};
  } catch {}

  const title = data.title || 'SolFlare Alert';
  const options = {
    body: data.body || 'Solar activity update',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'solflare-alert',
    data: { url: data.url || '/' },
    requireInteraction: true,
    silent: false,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: open the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
